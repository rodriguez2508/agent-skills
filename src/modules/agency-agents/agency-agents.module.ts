import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { AgentCategory } from '@modules/agency-agents/domain/entities/agent-category.entity';
import { AgentCatalog } from '@modules/agency-agents/domain/entities/agent-catalog.entity';
import { AgentSessionContext } from '@modules/agency-agents/domain/entities/agent-session-context.entity';
import { AgentInvocationPattern } from '@modules/agency-agents/domain/entities/agent-invocation-pattern.entity';
import { AgentConfig } from '@modules/agency-agents/domain/entities/agent-config.entity';

// Services
import { AgentCatalogService } from '@modules/agency-agents/application/services/agent-catalog.service';
import { AgentCatalogSeederService } from '@modules/agency-agents/application/services/agent-catalog-seeder.service';
import { PatternService } from '@modules/agency-agents/application/services/pattern.service';
import { AgentConfigService } from '@modules/agency-agents/application/services/agent-config.service';
import { InstallService } from '@modules/agency-agents/application/services/install.service';
import { BackupService } from '@modules/agency-agents/application/services/backup.service';
import { SddInstallerService } from '@modules/agency-agents/application/services/sdd-installer.service';
import { SkillsInstallerService } from '@modules/agency-agents/application/services/skills-installer.service';
import { McpInstallerService } from '@modules/agency-agents/application/services/mcp-installer.service';
import { PersonaInstallerService } from '@modules/agency-agents/application/services/persona-installer.service';
import { ClaudeMdUpdaterService } from '@modules/agency-agents/application/services/claude-md-updater.service';


// Infrastructure
import { FileMergeService } from '@infrastructure/file-merge/file-merge.service';
import { AssetLoaderService } from '@infrastructure/assets/asset-loader.service';
import { SystemService } from '@infrastructure/system/system.service';
import { AgentConfigRegistryService } from '@infrastructure/adapters/agent-config/agent-config-registry.service';

// CQRS Commands
import {
  CreateAgentConfigHandler,
  UpdateAgentConfigHandler,
  DeleteAgentConfigHandler,
  InstallAgentHandler,
  SyncAgentHandler,
  CreateBackupHandler,
  RestoreBackupHandler,
  RecordTransitionHandler,
  UpdateClaudeMdHandler,
} from './application/commands';

// CQRS Queries
import {
  GetConfigsHandler,
  GetConfigHandler,
  GetAgentCatalogHandler,
  GetSuggestedNextHandler,
  GetBackupsHandler,
} from './application/queries';

// Controller
import { AgentConfigController } from './presentation/controllers/agent-config.controller';

/**
 * Agency Agents Module
 *
 * Manages AI agent CLI tool configurations per agency using CQRS pattern:
 * - Commands: create/update/delete configs, install/sync agents, backup/restore
 * - Queries: get configs, catalog, suggestions, backups
 * - Domain services for agent detection, skills installation, MCP configuration
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      AgentCategory,
      AgentCatalog,
      AgentSessionContext,
      AgentInvocationPattern,
      AgentConfig,
    ]),
    DatabaseModule,
  ],
  controllers: [AgentConfigController],
  providers: [
    // Infrastructure
    FileMergeService,
    AssetLoaderService,
    SystemService,

    // Agent Adapters
    AgentConfigRegistryService,

    // DB-backed Agent Config Service
    AgentConfigService,

    // Component Installers
    SddInstallerService,
    SkillsInstallerService,
    McpInstallerService,
    PersonaInstallerService,

    // Orchestration
    InstallService,
    BackupService,
    ClaudeMdUpdaterService,

    // Agent Catalog (BM2)
    AgentCatalogService,
    AgentCatalogSeederService,
    PatternService,

    // ── CQRS Command Handlers ──
    CreateAgentConfigHandler,
    UpdateAgentConfigHandler,
    DeleteAgentConfigHandler,
    InstallAgentHandler,
    SyncAgentHandler,
    CreateBackupHandler,
    RestoreBackupHandler,
    RecordTransitionHandler,
    UpdateClaudeMdHandler,

    // ── CQRS Query Handlers ──
    GetConfigsHandler,
    GetConfigHandler,
    GetAgentCatalogHandler,
    GetSuggestedNextHandler,
    GetBackupsHandler,
  ],
  exports: [
    AgentConfigRegistryService,
    AgentConfigService,
    InstallService,
    BackupService,
    SystemService,
    FileMergeService,
    AssetLoaderService,
    AgentCatalogService,
    PatternService,
    ClaudeMdUpdaterService,
    TypeOrmModule,
    CqrsModule,
  ],
})
export class CatalogModule implements OnModuleInit {
  private readonly logger = new Logger(CatalogModule.name);

  constructor(
    private readonly registry: AgentConfigRegistryService,
    private readonly configService: AgentConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Seed default agent configs if DB is empty
    await this.configService.seedDefaultsIfEmpty();

    // Load adapters from DB (default configs for global scope)
    const adapters = await this.configService.createAdaptersForAgency(null);
    for (const adapter of adapters) {
      this.registry.register(adapter);
    }

    this.logger.log(`✅ Agency Agents Module initialized`);
    this.logger.log(`📊 Registered agent adapters: ${this.registry.count()}`);
    this.logger.log(`📋 Agents: ${this.registry.supportedAgents().join(', ')}`);
  }
}
