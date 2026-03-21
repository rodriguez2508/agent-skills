import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';

/**
 * CodeAgent - Agente especializado en generación de código
 * Genera snippets de código y valida mejores prácticas
 */
@Injectable()
export class CodeAgent extends BaseAgent {
  constructor(
    private readonly agentLogger: AgentLoggerService,
  ) {
    super(
      'CodeAgent',
      'Genera y valida código siguiendo mejores prácticas',
    );
  }

  /**
   * Maneja la generación de código
   */
  protected async handle(request: AgentRequest): Promise<any> {
    const codeRequest = request.input;
    const language = request.options?.language as string || 'typescript';

    this.agentLogger.info(this.agentId, 'Generando código', {
      request: codeRequest.substring(0, 50),
      language,
    });

    // Aquí iría la lógica de generación de código
    // Por ahora devuelve una respuesta genérica
    return {
      message: 'Código generado exitosamente',
      language,
      snippet: `// Código generado para: ${codeRequest}`,
      bestPractices: [
        'Usa tipos explícitos',
        'Aplica principios SOLID',
        'Incluye tests unitarios',
      ],
    };
  }

  /**
   * Verifica si el input es sobre generación de código
   */
  canHandle(input: string): boolean {
    const codeKeywords = [
      'crear',
      'generar',
      'código',
      'implementar',
      'escribe',
      'haz un',
      'función',
      'clase',
      'método',
      'servicio',
      'controlador',
    ];

    return codeKeywords.some((keyword) => input.toLowerCase().includes(keyword));
  }
}
