import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { FileMergeService } from '@infrastructure/file-merge/file-merge.service';
import { AssetLoaderService } from '@infrastructure/assets/asset-loader.service';
import { SystemService } from '@infrastructure/system/system.service';
import { AgentConfigRegistryService } from '@infrastructure/adapters/agent-config/agent-config-registry.service';
import { QwenAgentAdapter } from '@infrastructure/adapters/agent-config/qwen.adapter';
import { OpenCodeAgentAdapter } from '@infrastructure/adapters/agent-config/opencode.adapter';
import { SddInstallerService } from '@modules/agents/application/services/sdd-installer.service';
import { SkillsInstallerService } from '@modules/agents/application/services/skills-installer.service';
import { McpInstallerService } from '@modules/agents/application/services/mcp-installer.service';
import { PersonaInstallerService } from '@modules/agents/application/services/persona-installer.service';
import { InstallService } from '@modules/agents/application/services/install.service';
import { BackupService } from '@modules/agents/application/services/backup.service';
import { AgentConfigController } from '@modules/agents/presentation/controllers/agent-config.controller';

/**
 * Agents Module (Agent Config / Gentle AI)
 *
 * Manages AI agent CLI tool configurations:
 * - Agent detection and adapters
 * - SDD skills installation
 * - MCP server configuration
 * - Persona injection
 * - Backup and rollback
 *
 * This module coexists with the existing IA agents (RouterAgent, CodeAgent, etc.)
 * under a separate domain: "agent-config" vs "ai-agents".
 */
@Module({
  imports: [],
  controllers: [AgentConfigController],
  providers: [
    // Infrastructure
    FileMergeService,
    AssetLoaderService,
    SystemService,

    // Agent Adapters
    AgentConfigRegistryService,
    QwenAgentAdapter,
    OpenCodeAgentAdapter,

    // Component Installers
    SddInstallerService,
    SkillsInstallerService,
    McpInstallerService,
    PersonaInstallerService,

    // Orchestration
    InstallService,
    BackupService,
  ],
  exports: [
    AgentConfigRegistryService,
    InstallService,
    BackupService,
    SystemService,
    FileMergeService,
    AssetLoaderService,
  ],
})
export class AgentsModule implements OnModuleInit {
  private readonly logger = new Logger(AgentsModule.name);

  constructor(
    private readonly registry: AgentConfigRegistryService,
    private readonly qwenAdapter: QwenAgentAdapter,
    private readonly opencodeAdapter: OpenCodeAgentAdapter,
  ) {}

  async onModuleInit(): Promise<void> {
    // Register all agent adapters
    this.registry.register(this.qwenAdapter);
    this.registry.register(this.opencodeAdapter);

    this.logger.log(`✅ Agent Config Module initialized`);
    this.logger.log(`📊 Registered agent adapters: ${this.registry.count()}`);
    this.logger.log(`📋 Agents: ${this.registry.supportedAgents().join(', ')}`);
  }
}
