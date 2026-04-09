import { SupportTier } from '../value-objects/support-tier.vo';

/**
 * Represents an AI agent CLI tool that can be configured.
 * Examples: Claude Code, Qwen CLI, OpenCode, Cursor, etc.
 */
export class AgentConfig {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly tier: SupportTier,
    public readonly configPath: string,
  ) {}
}
