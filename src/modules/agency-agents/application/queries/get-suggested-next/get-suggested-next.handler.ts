import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetSuggestedNextQuery } from './get-suggested-next.query';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentInvocationPattern } from '@modules/agency-agents/domain/entities/agent-invocation-pattern.entity';
import { Logger } from '@nestjs/common';

export interface SuggestedNext {
  agentId: string;
  action: string;
  intention: string;
  confidence: number;
  basedOn: string;
  fromPattern: boolean;
}

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

@QueryHandler(GetSuggestedNextQuery)
export class GetSuggestedNextHandler implements IQueryHandler<GetSuggestedNextQuery> {
  private readonly logger = new Logger(GetSuggestedNextHandler.name);

  constructor(
    @InjectRepository(AgentInvocationPattern)
    private readonly patternRepo: Repository<AgentInvocationPattern>,
  ) {}

  async execute(query: GetSuggestedNextQuery) {
    const { projectId, currentAgentId } = query;
    this.logger.debug(`Getting suggested next for: ${currentAgentId} in project: ${projectId}`);

    try {
      const patterns = await this.patternRepo
        .createQueryBuilder('p')
        .where('p.project_id = :projectId', { projectId })
        .andWhere('p.from_agent_id = :fromAgent', { fromAgent: currentAgentId })
        .andWhere('p.count >= 2')
        .orderBy('p.confirmed_count', 'DESC')
        .addOrderBy('p.count', 'DESC')
        .limit(3)
        .getMany();

      const viable = patterns.filter((p) => p.rejectedCount < p.count * 0.5);

      if (viable.length > 0) {
        const best = viable[0];
        const total = best.count;
        const confidence = Math.min(0.95, (best.confirmedCount + 1) / (total + 2));

        return {
          agentId: best.toAgentId,
          action: best.sampleInputs?.at(-1) ?? `Continuar con ${best.toAgentId}`,
          intention: best.intention ?? '',
          confidence: parseFloat(confidence.toFixed(2)),
          basedOn: `${total} sesión${total > 1 ? 'es' : ''} previas en este proyecto`,
          fromPattern: true,
        };
      }

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
}
