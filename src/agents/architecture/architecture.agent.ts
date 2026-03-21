import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';

/**
 * ArchitectureAgent - Agente especializado en validación arquitectónica
 * Verifica Clean Architecture, patrones y estructura de proyectos
 */
@Injectable()
export class ArchitectureAgent extends BaseAgent {
  constructor(
    private readonly agentLogger: AgentLoggerService,
  ) {
    super(
      'ArchitectureAgent',
      'Valida arquitectura y patrones de diseño',
    );
  }

  /**
   * Maneja la validación arquitectónica
   */
  protected async handle(request: AgentRequest): Promise<any> {
    const architectureRequest = request.input;

    this.agentLogger.info(this.agentId, 'Validando arquitectura', {
      request: architectureRequest.substring(0, 50),
    });

    // Aquí iría la lógica de validación arquitectónica
    return {
      message: 'Validación arquitectónica completada',
      analysis: {
        pattern: 'Clean Architecture',
        layers: ['Domain', 'Application', 'Infrastructure', 'Presentation'],
        compliance: '85%',
        recommendations: [
          'Separa claramente las capas de dominio e infraestructura',
          'Usa inyección de dependencias en todos los servicios',
          'Mantén las entidades libres de dependencias externas',
        ],
      },
    };
  }

  /**
   * Verifica si el input es sobre arquitectura
   */
  canHandle(input: string): boolean {
    const architectureKeywords = [
      'arquitectura',
      'architecture',
      'estructura',
      'patrón',
      'clean',
      'hexagonal',
      'capas',
      'diseño',
      'organización',
    ];

    return architectureKeywords.some((keyword) => input.toLowerCase().includes(keyword));
  }
}
