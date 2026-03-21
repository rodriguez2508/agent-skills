import { IAgent } from './agent.port';
import { AgentRequest, AgentResponse } from './agent-response';
import { Logger } from '@nestjs/common';

/**
 * Clase base abstracta para todos los agentes
 * Proporciona funcionalidad común como logging y tracking de ejecución
 */
export abstract class BaseAgent implements IAgent {
  protected readonly logger: Logger;

  constructor(
    public readonly agentId: string,
    public readonly description: string,
  ) {
    this.logger = new Logger(`[${agentId}]`);
  }

  /**
   * Ejecuta el agente con logging y tracking de tiempo
   */
  async execute(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    
    this.logger.log(`📥 Ejecutando con input: "${request.input.substring(0, 50)}..."`);

    try {
      const data = await this.handle(request);
      const executionTime = Date.now() - startTime;

      this.logger.log(`✅ Ejecución completada en ${executionTime}ms`);

      return {
        success: true,
        data,
        metadata: {
          agentId: this.agentId,
          executionTime,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      this.logger.error(`❌ Error: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        metadata: {
          agentId: this.agentId,
          executionTime,
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Método abstracto que cada agente debe implementar
   * Contiene la lógica específica del agente
   */
  protected abstract handle(request: AgentRequest): Promise<any>;

  /**
   * Por defecto, un agente puede manejar cualquier input
   * Los agentes específicos deben sobrescribir este método
   */
  canHandle(input: string): boolean {
    return true;
  }

  /**
   * Log de información del agente
   */
  protected logInfo(message: string): void {
    this.logger.log(`ℹ️ ${message}`);
  }

  /**
   * Log de debug del agente
   */
  protected logDebug(message: string): void {
    this.logger.debug(`🔍 ${message}`);
  }

  /**
   * Log de error del agente
   */
  protected logError(message: string): void {
    this.logger.error(`❌ ${message}`);
  }
}
