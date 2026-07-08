import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { BaseAgentAdapter } from './base-agent.adapter';
import { SupportTier } from '@modules/agents/domain/value-objects/support-tier.vo';
import { SystemPromptStrategy } from '@modules/agents/domain/value-objects/system-prompt-strategy.vo';
import { MCPStrategy } from '@modules/agents/domain/value-objects/mcp-strategy.vo';

/**
 * Adapter for Claude Code CLI agent.
 *
 * Config structure:
 *   ~/
 *   └── .claude.json       ← MCP servers (top-level mcpServers key)
 *   ~/.claude/
 *   ├── CLAUDE.md          ← System prompt (appended)
 *   ├── commands/          ← Skills as slash commands (.md files)
 *   └── settings.json      ← UI/theme settings (NOT used for MCP)
 *
 * Claude Code reads mcpServers from ~/.claude.json, not ~/.claude/settings.json.
 */
@Injectable()
export class ClaudeAgentAdapter extends BaseAgentAdapter {
  agent(): string {
    return 'claude-code';
  }

  tier(): SupportTier {
    return 'full';
  }

  globalConfigDir(homeDir: string): string {
    return path.join(homeDir, '.claude');
  }

  systemPromptFile(homeDir: string): string {
    return path.join(homeDir, '.claude', 'CLAUDE.md');
  }

  skillsDir(homeDir: string): string {
    return path.join(homeDir, '.claude', 'commands');
  }

  settingsPath(homeDir: string): string {
    // ~/.claude.json is the primary config file Claude Code reads for mcpServers
    return path.join(homeDir, '.claude.json');
  }

  systemPromptStrategy(): SystemPromptStrategy {
    return SystemPromptStrategy.AppendToFile;
  }

  mcpStrategy(): MCPStrategy {
    // Claude Code stores MCP servers under top-level mcpServers key in ~/.claude.json
    return MCPStrategy.MergeIntoSettings;
  }

  mcpConfigPath(homeDir: string, _serverName: string): string {
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
    return 'claude';
  }
}
