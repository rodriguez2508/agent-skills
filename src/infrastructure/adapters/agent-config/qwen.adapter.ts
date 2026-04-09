import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { BaseAgentAdapter } from './base-agent.adapter';
import { SupportTier } from '@modules/agents/domain/value-objects/support-tier.vo';
import { SystemPromptStrategy } from '@modules/agents/domain/value-objects/system-prompt-strategy.vo';
import { MCPStrategy } from '@modules/agents/domain/value-objects/mcp-strategy.vo';

/**
 * Adapter for Qwen CLI agent.
 *
 * Config structure:
 *   ~/.qwen/
 *   ├── INSTRUCTIONS.md    ← System prompt
 *   ├── skills/            ← Skills directory
 *   ├── settings.json      ← Agent settings
 *   └── mcp.json           ← MCP server config
 */
@Injectable()
export class QwenAgentAdapter extends BaseAgentAdapter {
  agent(): string {
    return 'qwen-cli';
  }

  tier(): SupportTier {
    return 'full';
  }

  globalConfigDir(homeDir: string): string {
    return path.join(homeDir, '.qwen');
  }

  systemPromptFile(homeDir: string): string {
    return path.join(homeDir, '.qwen', 'INSTRUCTIONS.md');
  }

  skillsDir(homeDir: string): string {
    return path.join(homeDir, '.qwen', 'skills');
  }

  settingsPath(homeDir: string): string {
    return path.join(homeDir, '.qwen', 'settings.json');
  }

  systemPromptStrategy(): SystemPromptStrategy {
    return SystemPromptStrategy.AppendToFile;
  }

  mcpStrategy(): MCPStrategy {
    return MCPStrategy.MCPConfigFile;
  }

  mcpConfigPath(_homeDir: string, _serverName: string): string {
    // Qwen uses a single mcp.json file for all servers
    return path.join(this.globalConfigDir(_homeDir), 'mcp.json');
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
    return 'qwen';
  }
}
