import { Injectable, Logger } from '@nestjs/common';
import { IAgent } from '@core/agents/agent.port';

/**
 * Registro centralizado de agentes
 * Permite registrar, obtener y listar todos los agentes disponibles
 */
@Injectable()
export class AgentRegistry {
  private readonly agents: Map<string, IAgent> = new Map();
  private readonly logger = new Logger(AgentRegistry.name);

  /**
   * Registra un agente en el registry
   */
  register(agent: IAgent): void {
    if (this.agents.has(agent.agentId)) {
      this.logger.warn(`⚠️ Agente "${agent.agentId}" ya está registrado, se va a sobrescribir`);
    }
    
    this.agents.set(agent.agentId, agent);
    this.logger.log(`✅ Agente registrado: ${agent.agentId} - ${agent.description}`);
  }

  /**
   * Obtiene un agente por su ID
   */
  getAgent(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Verifica si un agente está registrado
   */
  hasAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Lista todos los agentes registrados
   */
  listAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Obtiene todos los IDs de agentes registrados
   */
  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Encuentra un agente que pueda manejar un input específico
   */
  findAgentForInput(input: string): IAgent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.canHandle(input)) {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * Obtiene la cantidad de agentes registrados
   */
  count(): number {
    return this.agents.size;
  }

  /**
   * Elimina un agente del registry
   */
  unregister(agentId: string): void {
    if (this.agents.delete(agentId)) {
      this.logger.log(`🗑️ Agente eliminado: ${agentId}`);
    }
  }

  /**
   * Limpia todos los agentes registrados
   */
  clear(): void {
    this.agents.clear();
    this.logger.log('🗑️ Todos los agentes han sido eliminados');
  }
}
