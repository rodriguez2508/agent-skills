import { Injectable, Logger } from '@nestjs/common';
import { IAgentAdapter, DetectionResult } from '@modules/agents/domain/ports/agent-adapter.port';

/**
 * Registry of all agent adapters.
 * Provides centralized access to agent detection and configuration.
 */
@Injectable()
export class AgentConfigRegistryService {
  private readonly logger = new Logger(AgentConfigRegistryService.name);
  private readonly adapters = new Map<string, IAgentAdapter>();

  /**
   * Registers an agent adapter.
   */
  register(adapter: IAgentAdapter): void {
    this.adapters.set(adapter.agent(), adapter);
    this.logger.debug(`Registered agent adapter: ${adapter.agent()}`);
  }

  /**
   * Gets an adapter by agent ID.
   */
  getAdapter(agentId: string): IAgentAdapter | undefined {
    return this.adapters.get(agentId);
  }

  /**
   * Returns all registered adapters.
   */
  getAllAdapters(): IAgentAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Returns all supported agent IDs.
   */
  supportedAgents(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Detects all registered agents on the system.
   */
  async detectAll(homeDir: string): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    for (const adapter of this.adapters.values()) {
      try {
        const result = await adapter.detect(homeDir);
        results.push(result);
      } catch (error) {
        this.logger.warn(
          `Failed to detect ${adapter.agent()}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        results.push({
          installed: false,
          binaryPath: null,
          configPath: adapter.globalConfigDir(homeDir),
          configFound: false,
        });
      }
    }

    return results;
  }

  /**
   * Returns the number of registered adapters.
   */
  count(): number {
    return this.adapters.size;
  }
}
