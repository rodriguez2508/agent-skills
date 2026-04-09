import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import { IAgentAdapter } from '@modules/agents/domain/ports/agent-adapter.port';
import { MCPStrategy } from '@modules/agents/domain/value-objects/mcp-strategy.vo';
import { FileMergeService } from '@infrastructure/file-merge/file-merge.service';

/**
 * MCP server configuration installer.
 * Configures MCP servers in each agent according to its strategy.
 */
@Injectable()
export class McpInstallerService {
  private readonly logger = new Logger(McpInstallerService.name);
  private readonly mcpServerUrl: string;

  constructor(
    private readonly fileMerge: FileMergeService,
    private readonly configService: ConfigService,
  ) {
    const port = this.configService.get<number>('PORT', 8004);
    this.mcpServerUrl = this.configService.get<string>(
      'MCP_SERVER_URL',
      `http://localhost:${port}/mcp/sse`,
    );
  }

  /**
   * Configures an MCP server in an agent.
   *
   * @param adapter - The agent adapter
   * @param homeDir - User's home directory
   * @param serverName - MCP server name
   * @param serverConfig - Server configuration (URL, command, args, etc.)
   */
  async installServer(
    adapter: IAgentAdapter,
    homeDir: string,
    serverName: string,
    serverConfig: Record<string, unknown>,
  ): Promise<void> {
    if (!adapter.supportsMCP()) {
      this.logger.debug(`Agent ${adapter.agent()} does not support MCP. Skipping.`);
      return;
    }

    const strategy = adapter.mcpStrategy();
    const configPath = adapter.mcpConfigPath(homeDir, serverName);

    switch (strategy) {
      case MCPStrategy.SeparateFiles:
        await this.installSeparateFile(configPath, serverName, serverConfig);
        break;

      case MCPStrategy.MergeIntoSettings:
        await this.mergeIntoSettings(adapter.settingsPath(homeDir), serverName, serverConfig);
        break;

      case MCPStrategy.MCPConfigFile:
        await this.installMcpConfigFile(configPath, serverName, serverConfig);
        break;

      case MCPStrategy.TOMLFile:
        await this.installTomlConfig(configPath, serverName, serverConfig);
        break;

      default:
        this.logger.warn(`Unknown MCP strategy for ${adapter.agent()}: ${strategy}`);
    }
  }

  /**
   * Installs multiple MCP servers at once.
   */
  async installServers(
    adapter: IAgentAdapter,
    homeDir: string,
    servers: Record<string, Record<string, unknown>>,
  ): Promise<void> {
    for (const [name, config] of Object.entries(servers)) {
      await this.installServer(adapter, homeDir, name, config);
    }
    this.logger.log(`Installed ${Object.keys(servers).length} MCP servers for: ${adapter.agent()}`);
  }

  /**
   * Installs the default agent-skills-api MCP server.
   * This is the main integration point for Qwen and other agents.
   */
  async installDefaultServer(adapter: IAgentAdapter, homeDir: string): Promise<void> {
    if (!adapter.supportsMCP()) {
      this.logger.debug(`Agent ${adapter.agent()} does not support MCP. Skipping.`);
      return;
    }

    const serverConfig = {
      url: this.mcpServerUrl,
      autoApprove: [
        'search_rules',
        'get_rule',
        'list_rules',
        'auto_apply_rules',
        'context7_docs',
        'agent_query',
        'register_project',
      ],
    };

    await this.installServer(adapter, homeDir, 'agent-skills-api', serverConfig);
    this.logger.log(`Default MCP server installed for: ${adapter.agent()}`);
  }

  /**
   * Strategy: Separate JSON files per server.
   * Example: ~/.claude/mcp/{server}.json
   */
  private async installSeparateFile(
    configPath: string,
    _serverName: string,
    serverConfig: Record<string, unknown>,
  ): Promise<void> {
    const content = JSON.stringify(serverConfig, null, 2);
    await this.fileMerge.writeWithMarkers(configPath, content, 'mcp-server');
  }

  /**
   * Strategy: Merge into settings.json.
   * Example: OpenCode, Gemini
   */
  private async mergeIntoSettings(
    settingsPath: string,
    serverName: string,
    serverConfig: Record<string, unknown>,
  ): Promise<void> {
    const content = JSON.stringify({ mcpServers: { [serverName]: serverConfig } }, null, 2);
    await this.fileMerge.writeWithMarkers(settingsPath, content, `mcp-${serverName}`);
  }

  /**
   * Strategy: Dedicated mcp.json file.
   * Example: Cursor, Qwen CLI
   * NOTE: JSON files cannot have HTML markers — we merge cleanly.
   */
  private async installMcpConfigFile(
    configPath: string,
    serverName: string,
    serverConfig: Record<string, unknown>,
  ): Promise<void> {
    let existing: Record<string, unknown> = {};

    // Try to read existing mcp.json
    try {
      const raw = await fs.readFile(configPath, 'utf-8');
      // Strip any HTML markers if present
      const cleanJson = raw.replace(/<!--[\s\S]*?-->/g, '').trim();
      if (cleanJson) {
        existing = JSON.parse(cleanJson);
      }
    } catch {
      // File doesn't exist yet
    }

    // Add/update this server
    if (!existing.mcpServers) {
      existing.mcpServers = {};
    }
    (existing.mcpServers as Record<string, unknown>)[serverName] = serverConfig;

    // Write clean JSON without markers
    const content = JSON.stringify(existing, null, 2) + '\n';
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, content, 'utf-8');
  }

  /**
   * Strategy: TOML config file.
   * Example: Codex
   */
  private async installTomlConfig(
    configPath: string,
    serverName: string,
    serverConfig: Record<string, unknown>,
  ): Promise<void> {
    // Simple TOML generation (for production, use a proper TOML library)
    const tomlLines = [`[mcp_servers.${serverName}]`];

    for (const [key, value] of Object.entries(serverConfig)) {
      if (typeof value === 'string') {
        tomlLines.push(`${key} = "${value}"`);
      } else if (Array.isArray(value)) {
        tomlLines.push(`${key} = [${value.map((v) => `"${v}"`).join(', ')}]`);
      } else if (typeof value === 'boolean') {
        tomlLines.push(`${key} = ${value}`);
      } else if (typeof value === 'number') {
        tomlLines.push(`${key} = ${value}`);
      }
    }

    const content = tomlLines.join('\n');
    await this.fileMerge.writeWithMarkers(configPath, content, `mcp-${serverName}`);
  }
}
