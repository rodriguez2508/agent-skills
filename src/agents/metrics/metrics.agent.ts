import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';

/**
 * MetricsAgent - Agente especializado en métricas y tracking
 * Registra uso de agentes y genera estadísticas
 */
@Injectable()
export class MetricsAgent extends BaseAgent {
  private readonly metrics: Map<string, any[]> = new Map();

  constructor(
    private readonly agentLogger: AgentLoggerService,
  ) {
    super(
      'MetricsAgent',
      'Registra métricas y genera estadísticas de uso',
    );
  }

  /**
   * Maneja las solicitudes de métricas
   */
  protected async handle(request: AgentRequest): Promise<any> {
    const metricsRequest = request.input;

    this.agentLogger.info(this.agentId, 'Procesando solicitud de métricas', {
      request: metricsRequest.substring(0, 50),
    });

    // Obtener estadísticas
    const stats = this.getStats();

    return {
      message: 'Estadísticas obtenidas',
      stats,
      totalRequests: this.getTotalRequests(),
      agentsActive: this.getAgentsActive(),
    };
  }

  /**
   * Registra una métrica de uso de agente
   */
  trackAgentUsage(agentId: string, executionTime: number, success: boolean): void {
    const metric = {
      agentId,
      executionTime,
      success,
      timestamp: new Date(),
    };

    if (!this.metrics.has(agentId)) {
      this.metrics.set(agentId, []);
    }
    this.metrics.get(agentId)!.push(metric);

    this.agentLogger.debug(this.agentId, `Métrica registrada: ${agentId}`, {
      executionTime,
      success,
    });
  }

  /**
   * Obtiene estadísticas generales
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [agentId, metrics] of this.metrics.entries()) {
      stats[agentId] = {
        total: metrics.length,
        avgExecutionTime:
          metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length,
        successRate:
          (metrics.filter((m) => m.success).length / metrics.length) * 100,
      };
    }

    return stats;
  }

  /**
   * Obtiene el total de requests
   */
  getTotalRequests(): number {
    let total = 0;
    for (const metrics of this.metrics.values()) {
      total += metrics.length;
    }
    return total;
  }

  /**
   * Obtiene la cantidad de agentes activos
   */
  getAgentsActive(): number {
    return this.metrics.size;
  }

  /**
   * Verifica si el input es sobre métricas
   */
  canHandle(input: string): boolean {
    const metricsKeywords = [
      'métricas',
      'metrics',
      'estadísticas',
      'stats',
      'uso',
      'rendimiento',
      'performance',
      'cuántos',
      'cuántas',
    ];

    return metricsKeywords.some((keyword) => input.toLowerCase().includes(keyword));
  }
}
