import { SupportTier } from '@modules/agency-agents/domain/value-objects/support-tier.vo';
import { SystemPromptStrategy } from '@modules/agency-agents/domain/value-objects/system-prompt-strategy.vo';
import { MCPStrategy } from '@modules/agency-agents/domain/value-objects/mcp-strategy.vo';
import { AgentConfig } from '@modules/agency-agents/domain/entities/agent-config.entity';
import { BaseAgentAdapter } from '@infrastructure/adapters/agent-config/base-agent.adapter';

/**
 * DB-backed Agent Adapter
 *
 * Implements IAgentAdapter using configuration stored in the database
 * instead of hardcoded class constants. This allows each agency to
 * customize their agent configurations.
 */
export class DbAgentAdapter extends BaseAgentAdapter {
  constructor(private readonly config: AgentConfig) {
    super();
  }

  agent(): string {
    return this.config.agentId;
  }

  tier(): SupportTier {
    return (this.config.tier as SupportTier) || 'full';
  }

  globalConfigDir(homeDir: string): string {
    return this.expandHome(this.config.configDir, homeDir);
  }

  systemPromptFile(homeDir: string): string {
    return this.expandHome(this.config.systemPromptFile, homeDir);
  }

  skillsDir(homeDir: string): string {
    return this.expandHome(this.config.skillsDir, homeDir);
  }

  settingsPath(homeDir: string): string {
    return this.expandHome(this.config.settingsPath, homeDir);
  }

  systemPromptStrategy(): SystemPromptStrategy {
    return this.config.systemPromptStrategy as SystemPromptStrategy;
  }

  mcpStrategy(): MCPStrategy {
    return this.config.mcpStrategy as MCPStrategy;
  }

  mcpConfigPath(homeDir: string, serverName: string): string {
    if (this.config.mcpConfigPath) {
      return this.expandHome(
        this.config.mcpConfigPath.replace('{serverName}', serverName),
        homeDir,
      );
    }
    // Default: merge into settings
    return this.settingsPath(homeDir);
  }

  supportsSkills(): boolean {
    return this.config.supportsSkills;
  }

  supportsSystemPrompt(): boolean {
    return this.config.supportsSystemPrompt;
  }

  supportsMCP(): boolean {
    return this.config.supportsMCP;
  }

  protected getBinaryName(): string {
    return this.config.binaryName || this.config.agentId;
  }


}
