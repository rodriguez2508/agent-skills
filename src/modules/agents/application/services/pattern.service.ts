import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AgentInvocationPattern } from '@modules/agents/domain/entities/agent-invocation-pattern.entity';
import { RedisService } from '@infrastructure/database/redis/redis.service';

export interface SuggestedNext {
  agentId: string;
  action: string;
  intention: string;
  confidence: number;         // 0-1
  basedOn: string;            // texto descriptivo
  fromPattern: boolean;       // true = aprendido, false = heurística
}

const PENDING_NEXT_TTL = 60 * 30; // 30 min — ventana para confirmar/rechazar

/** Heurísticas de transición cuando no hay patrones suficientes */
const HEURISTIC_NEXT: Record<string, { agentId: string; action: string; intention: string }> = {
  PMAgent:             { agentId: 'CodeAgent',         action: 'Implementar lo planificado',       intention: 'code' },
  CodeAgent:           { agentId: 'IssueWorkflowAgent', action: 'Avanzar en el workflow del issue', intention: 'issue-workflow' },
  IssueWorkflowAgent:  { agentId: 'GitHubAgent',        action: 'Crear PR en GitHub',               intention: 'github' },
  ArchitectureAgent:   { agentId: 'CodeAgent',          action: 'Implementar la arquitectura',      intention: 'code' },
  FrontendArchitectureAgent: { agentId: 'CodeAgent',    action: 'Implementar componentes',          intention: 'code' },
  AnalysisAgent:       { agentId: 'CodeAgent',          action: 'Aplicar correcciones encontradas', intention: 'code' },
  GitHubAgent:         { agentId: 'IssueWorkflowAgent', action: 'Actualizar estado del issue',      intention: 'issue-workflow' },
  ProjectHistoryAgent: { agentId: 'PMAgent',            action: 'Crear issue para continuar',       intention: 'pm' },
};

@Injectable()
export class PatternService {
  private readonly logger = new Logger(PatternService.name);

  constructor(
    @InjectRepository(AgentInvocationPattern)
    private readonly patternRepo: Repository<AgentInvocationPattern>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Registra una transición agente→agente en el proyecto.
   * Upsert por (projectId, fromAgentId, toAgentId, intention).
   */
  async recordTransition(
    projectId: string,
    fromAgentId: string | null,
    toAgentId: string,
    intention: string,
    sampleInput: string,
  ): Promise<void> {
    if (!projectId || !toAgentId) return;

    try {
      const where = {
        projectId,
        fromAgentId: fromAgentId ?? IsNull(),
        toAgentId,
        intention: intention ?? null,
      } as any;

      let pattern = await this.patternRepo.findOne({ where });

      if (pattern) {
        const inputs = [...(pattern.sampleInputs ?? []), sampleInput.substring(0, 100)].slice(-5);
        await this.patternRepo.update(pattern.id, {
          count: pattern.count + 1,
          sampleInputs: inputs,
        });
      } else {
        await this.patternRepo.save(
          this.patternRepo.create({
            projectId,
            fromAgentId,
            toAgentId,
            intention,
            count: 1,
            sampleInputs: [sampleInput.substring(0, 100)],
          }),
        );
      }
    } catch (e) {
      this.logger.warn(`recordTransition failed: ${e.message}`);
    }
  }

  /**
   * Registra que el usuario confirmó la sugerencia.
   */
  async recordConfirmation(projectId: string, fromAgentId: string, toAgentId: string): Promise<void> {
    try {
      const pattern = await this.patternRepo.findOne({
        where: { projectId, fromAgentId, toAgentId } as any,
      });
      if (pattern) {
        await this.patternRepo.update(pattern.id, {
          confirmedCount: pattern.confirmedCount + 1,
        });
      }
    } catch (e) {
      this.logger.warn(`recordConfirmation failed: ${e.message}`);
    }
  }

  /**
   * Registra que el usuario rechazó la sugerencia.
   */
  async recordRejection(projectId: string, fromAgentId: string, toAgentId: string): Promise<void> {
    try {
      const pattern = await this.patternRepo.findOne({
        where: { projectId, fromAgentId, toAgentId } as any,
      });
      if (pattern) {
        await this.patternRepo.update(pattern.id, {
          rejectedCount: pattern.rejectedCount + 1,
        });
      }
    } catch (e) {
      this.logger.warn(`recordRejection failed: ${e.message}`);
    }
  }

  /**
   * Calcula la mejor sugerencia de siguiente agente para un proyecto
   * dado el agente que acaba de actuar.
   */
  async getSuggestedNext(
    projectId: string,
    currentAgentId: string,
  ): Promise<SuggestedNext | null> {
    try {
      // Buscar patrones aprendidos (al menos 2 ocurrencias y más confirmaciones que rechazos)
      const patterns = await this.patternRepo
        .createQueryBuilder('p')
        .where('p.project_id = :projectId', { projectId })
        .andWhere('p.from_agent_id = :fromAgent', { fromAgent: currentAgentId })
        .andWhere('p.count >= 2')
        .orderBy('p.confirmed_count', 'DESC')
        .addOrderBy('p.count', 'DESC')
        .limit(3)
        .getMany();

      // Filtrar los rechazados consistentemente (>50% rechazo)
      const viable = patterns.filter(
        (p) => p.rejectedCount < p.count * 0.5,
      );

      if (viable.length > 0) {
        const best = viable[0];
        const total = best.count;
        const confidence = Math.min(0.95, (best.confirmedCount + 1) / (total + 2));

        return {
          agentId: best.toAgentId,
          action: best.sampleInputs.at(-1) ?? `Continuar con ${best.toAgentId}`,
          intention: best.intention ?? '',
          confidence: parseFloat(confidence.toFixed(2)),
          basedOn: `${total} sesión${total > 1 ? 'es' : ''} previas en este proyecto`,
          fromPattern: true,
        };
      }

      // Fallback: heurística estática
      const heuristic = HEURISTIC_NEXT[currentAgentId];
      if (heuristic) {
        return {
          ...heuristic,
          confidence: 0.5,
          basedOn: 'flujo recomendado por defecto',
          fromPattern: false,
        };
      }

      return null;
    } catch (e) {
      this.logger.warn(`getSuggestedNext failed: ${e.message}`);
      return null;
    }
  }

  /** Persiste sugerencia pendiente en Redis para que el próximo turno la recupere */
  async storePendingNext(sessionId: string, suggestion: SuggestedNext, fromAgentId: string): Promise<void> {
    await this.redisService.set(
      `session:${sessionId}:pending_next`,
      { ...suggestion, fromAgentId },
      PENDING_NEXT_TTL,
    );
  }

  /** Recupera la sugerencia pendiente y la elimina de Redis */
  async consumePendingNext(sessionId: string): Promise<(SuggestedNext & { fromAgentId: string }) | null> {
    const data = await this.redisService.get<SuggestedNext & { fromAgentId: string }>(
      `session:${sessionId}:pending_next`,
    );
    if (data) {
      await this.redisService.del(`session:${sessionId}:pending_next`);
    }
    return data;
  }

  /** Recupera el último agente invocado en una sesión */
  async getLastAgent(sessionId: string): Promise<string | null> {
    return this.redisService.get<string>(`session:${sessionId}:last_agent`);
  }

  /** Persiste el último agente invocado */
  async setLastAgent(sessionId: string, agentId: string): Promise<void> {
    await this.redisService.set(`session:${sessionId}:last_agent`, agentId, 3600);
  }
}
