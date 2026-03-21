import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';

/**
 * AnalysisAgent - Agente especializado en análisis de código
 * Analiza código existente y detecta problemas potenciales
 */
@Injectable()
export class AnalysisAgent extends BaseAgent {
  constructor(
    private readonly agentLogger: AgentLoggerService,
  ) {
    super(
      'AnalysisAgent',
      'Analiza código y detecta problemas potenciales',
    );
  }

  /**
   * Maneja el análisis de código
   */
  protected async handle(request: AgentRequest): Promise<any> {
    const analysisRequest = request.input;

    this.agentLogger.info(this.agentId, 'Analizando código', {
      request: analysisRequest.substring(0, 50),
    });

    // Aquí iría la lógica de análisis de código
    return {
      message: 'Análisis completado',
      findings: {
        issues: [],
        warnings: [
          'Considera agregar más tests unitarios',
          'Algunas funciones podrían ser más pequeñas',
        ],
        suggestions: [
          'Aplica el principio de responsabilidad única',
          'Considera usar más composición que herencia',
        ],
      },
    };
  }

  /**
   * Verifica si el input es sobre análisis
   */
  canHandle(input: string): boolean {
    const analysisKeywords = [
      'analiza',
      'analizar',
      'análisis',
      'revisa',
      'verifica',
      'encuentra problemas',
      'detecta',
      'evalúa',
      'revisar código',
    ];

    return analysisKeywords.some((keyword) => input.toLowerCase().includes(keyword));
  }
}
