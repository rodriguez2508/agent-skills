import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { AgentCategory } from '@modules/agency-agents/domain/entities/agent-category.entity';
import { AgentCatalog } from '@modules/agency-agents/domain/entities/agent-catalog.entity';
import { AgentSessionContext } from '@modules/agency-agents/domain/entities/agent-session-context.entity';
import { AgentInvocationPattern } from '@modules/agency-agents/domain/entities/agent-invocation-pattern.entity';
import { AgentConfig } from '@modules/agency-agents/domain/entities/agent-config.entity';


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
  CreateBackupHandler,
  RestoreBackupHandler,
  RecordTransitionHandler,
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

    // ── CQRS Command Handlers ──
    CreateAgentConfigHandler,
    UpdateAgentConfigHandler,
    DeleteAgentConfigHandler,
    CreateBackupHandler,
    RestoreBackupHandler,
    RecordTransitionHandler,

    // ── CQRS Query Handlers ──
    GetConfigsHandler,
    GetConfigHandler,
    GetAgentCatalogHandler,
    GetSuggestedNextHandler,
    GetBackupsHandler,
  ],
  exports: [
    AgentConfigRegistryService,
    SystemService,
    FileMergeService,
    AssetLoaderService,
    TypeOrmModule,
    CqrsModule,
  ],
})
export class CatalogModule {}
