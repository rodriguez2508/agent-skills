import { AgentRequest, AgentResponse } from './agent-response';

/**
 * Interfaz base para todos los agentes
 */
export interface IAgent {
  /**
   * ID único del agente
   */
  readonly agentId: string;

  /**
   * Descripción del agente
   */
  readonly description: string;

  /**
   * Ejecuta el agente con el request dado
   */
  execute(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Verifica si el agente puede manejar el input dado
   */
  canHandle(input: string): boolean;
}
