import { SupportTier } from '../value-objects/support-tier.vo';
import { SystemPromptStrategy } from '../value-objects/system-prompt-strategy.vo';
import { MCPStrategy } from '../value-objects/mcp-strategy.vo';

/**
 * Result of detecting whether an agent is installed and configured.
 */
export interface DetectionResult {
  installed: boolean;
  binaryPath: string | null;
  configPath: string;
  configFound: boolean;
  version?: string;
}

/**
 * Port defining how to interact with a specific AI agent CLI tool.
 * Each agent (Claude Code, Qwen CLI, OpenCode, etc.) implements this interface
 * to provide its specific configuration paths and strategies.
 */
export interface IAgentAdapter {
  /**
   * Unique agent identifier (e.g., 'claude-code', 'qwen-cli', 'opencode')
   */
  agent(): string;

  /**
   * Support tier for this agent.
   */
  tier(): SupportTier;

  /**
   * Detects if the agent is installed on the system.
   */
  detect(homeDir: string): Promise<DetectionResult>;

  /**
   * Returns the global config directory path for this agent.
   * Example: ~/.claude, ~/.qwen
   */
  globalConfigDir(homeDir: string): string;

  /**
   * Returns the path to the system prompt file.
   * Example: ~/.claude/CLAUDE.md, ~/.qwen/INSTRUCTIONS.md
   */
  systemPromptFile(homeDir: string): string;

  /**
   * Returns the skills directory path.
   * Example: ~/.claude/skills, ~/.qwen/skills
   */
  skillsDir(homeDir: string): string;

  /**
   * Returns the settings file path.
   * Example: ~/.claude/settings.json, ~/.qwen/settings.json
   */
  settingsPath(homeDir: string): string;

  /**
   * Returns the strategy for injecting system prompts.
   */
  systemPromptStrategy(): SystemPromptStrategy;

  /**
   * Returns the strategy for configuring MCP servers.
   */
  mcpStrategy(): MCPStrategy;

  /**
   * Returns the MCP config file path for a given server name.
   */
  mcpConfigPath(homeDir: string, serverName: string): string;

  /**
   * Whether this agent supports skill installation.
   */
  supportsSkills(): boolean;

  /**
   * Whether this agent supports system prompt injection.
   */
  supportsSystemPrompt(): boolean;

  /**
   * Whether this agent supports MCP server configuration.
   */
  supportsMCP(): boolean;
}
