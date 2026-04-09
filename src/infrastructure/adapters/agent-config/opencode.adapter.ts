import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { BaseAgentAdapter } from './base-agent.adapter';
import { SupportTier } from '@modules/agents/domain/value-objects/support-tier.vo';
import { SystemPromptStrategy } from '@modules/agents/domain/value-objects/system-prompt-strategy.vo';
import { MCPStrategy } from '@modules/agents/domain/value-objects/mcp-strategy.vo';

/**
 * Adapter for OpenCode agent.
 *
 * Config structure:
 *   ~/.opencode/
 *   ├── AGENTS.md          ← System prompt (full replace)
 *   ├── skills/            ← Skills directory
 *   └── settings.json      ← Settings + MCP config (merged)
 */
@Injectable()
export class OpenCodeAgentAdapter extends BaseAgentAdapter {
  agent(): string {
    return 'opencode';
  }

  tier(): SupportTier {
    return 'full';
  }

  globalConfigDir(homeDir: string): string {
    return path.join(homeDir, '.opencode');
  }

  systemPromptFile(homeDir: string): string {
    return path.join(homeDir, '.opencode', 'AGENTS.md');
  }

  skillsDir(homeDir: string): string {
    return path.join(homeDir, '.opencode', 'skills');
  }

  settingsPath(homeDir: string): string {
    return path.join(homeDir, '.opencode', 'settings.json');
  }

  systemPromptStrategy(): SystemPromptStrategy {
    return SystemPromptStrategy.FileReplace;
  }

  mcpStrategy(): MCPStrategy {
    return MCPStrategy.MergeIntoSettings;
  }

  mcpConfigPath(homeDir: string, _serverName: string): string {
    // OpenCode merges MCP config into settings.json
    return this.settingsPath(homeDir);
  }

  supportsSkills(): boolean {
    return true;
  }

  supportsSystemPrompt(): boolean {
    return true;
  }

  supportsMCP(): boolean {
    return true;
  }

  protected override getBinaryName(): string {
    return 'opencode';
  }
}
