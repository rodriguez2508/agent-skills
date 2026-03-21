import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest, AgentResponse } from '@core/agents/agent-response';
import { AgentRegistry } from '@core/agents/agent-registry';
import { AgentLoggerService, LogLevel } from '@infrastructure/logging/agent-logger.service';

/**
 * RouterAgent - Orquestador principal de agentes
 * Detecta la intención del usuario y enruta al agente especializado
 */
@Injectable()
export class RouterAgent extends BaseAgent {
  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly agentLogger: AgentLoggerService,
  ) {
    super(
      'RouterAgent',
      'Orquesta y enruta solicitudes a los agentes especializados',
    );
  }

  /**
   * Maneja la solicitud detectando intención y enrutando
   */
  protected async handle(request: AgentRequest): Promise<AgentResponse> {
    this.agentLogger.info(this.agentId, 'Recibida solicitud de enrutamiento', {
      input: request.input,
    });

    // Detectar intención
    const intention = this.detectIntention(request.input);
    
    this.agentLogger.debug(this.agentId, 'Intención detectada', {
      intention,
    });

    // Encontrar agente especializado
    const targetAgent = this.findSpecializedAgent(intention);

    if (!targetAgent) {
      this.agentLogger.warn(this.agentId, 'No se encontró agente especializado', {
        intention,
      });
      
      // Si no hay agente especializado, devolver respuesta genérica
      return {
        success: false,
        error: 'No hay un agente especializado para esta solicitud',
        metadata: {
          agentId: this.agentId,
          executionTime: 0,
          timestamp: new Date(),
        },
      };
    }

    this.agentLogger.info(this.agentId, `Enrutando a ${targetAgent.agentId}`, {
      intention,
      targetAgent: targetAgent.agentId,
    });

    // Ejecutar agente especializado
    const response = await targetAgent.execute(request);

    this.agentLogger.info(this.agentId, `Respuesta de ${targetAgent.agentId}`, {
      success: response.success,
      executionTime: response.metadata?.executionTime,
    });

    return response;
  }

  /**
   * Detecta la intención del input del usuario
   */
  private detectIntention(input: string): string {
    const lowerInput = input.toLowerCase();

    // Patrones de búsqueda
    if (this.matchesPattern(lowerInput, ['buscar', 'encuentra', 'search', 'qué hay', 'mostrar reglas'])) {
      return 'search';
    }

    // Patrones de código
    if (this.matchesPattern(lowerInput, ['crear', 'generar', 'código', 'implementar', 'escribe', 'haz'])) {
      return 'code';
    }

    // Patrones de reglas
    if (this.matchesPattern(lowerInput, ['regla', 'reglas', 'rule', 'rules', 'lista', 'listar'])) {
      return 'rules';
    }

    // Patrones de arquitectura
    if (this.matchesPattern(lowerInput, ['arquitectura', 'architecture', 'estructura', 'patrón', 'clean'])) {
      return 'architecture';
    }

    // Patrones de análisis
    if (this.matchesPattern(lowerInput, ['analiza', 'analizar', 'análisis', 'revisa', 'verifica'])) {
      return 'analysis';
    }

    // Patrones de identidad
    if (this.matchesPattern(lowerInput, ['quién eres', 'quien eres', 'identidad', 'prefijo', 'mcp'])) {
      return 'identity';
    }

    // Patrones de métricas
    if (this.matchesPattern(lowerInput, ['métricas', 'metrics', 'estadísticas', 'uso', 'rendimiento'])) {
      return 'metrics';
    }

    // Por defecto, intentar búsqueda
    return 'search';
  }

  /**
   * Encuentra un agente especializado para la intención dada
   */
  private findSpecializedAgent(intention: string) {
    const agentMap: Record<string, string> = {
      'search': 'SearchAgent',
      'code': 'CodeAgent',
      'rules': 'RulesAgent',
      'architecture': 'ArchitectureAgent',
      'analysis': 'AnalysisAgent',
      'identity': 'IdentityAgent',
      'metrics': 'MetricsAgent',
    };

    const targetAgentId = agentMap[intention];

    if (!targetAgentId) {
      return undefined;
    }

    return this.agentRegistry.getAgent(targetAgentId);
  }

  /**
   * Verifica si el input coincide con algún patrón
   */
  private matchesPattern(input: string, patterns: string[]): boolean {
    return patterns.some((pattern) => input.includes(pattern));
  }

  /**
   * Registra todos los agentes disponibles en el router
   */
  registerAllAgents(): void {
    const agents = this.agentRegistry.listAgents();
    this.agentLogger.info(this.agentId, 'Agentes disponibles', {
      count: agents.length,
      agents: agents.map((a) => a.agentId),
    });
  }
}
