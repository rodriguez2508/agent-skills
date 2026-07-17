import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AgentConfigRegistryService } from '@infrastructure/adapters/agent-config/agent-config-registry.service';

// CQRS Commands
import {
  InstallAgentCommand,
  SyncAgentCommand,
  UpdateClaudeMdCommand,
} from '../../application/commands';

// DTOs
import { InstallAgentDto } from '../dto/install-agent.dto';
import { SyncAgentDto } from '../dto/sync-agent.dto';
import { DetectionResponseDto } from '../dto/detection-response.dto';

/**
 * Agent Config Controller
 *
 * HTTP endpoints for managing AI agent CLI configurations.
 * Uses CQRS pattern: commands for mutations, queries for reads.
 */
@ApiTags('agent-config')
@Controller('agent-config')
export class AgentConfigController {
  private readonly logger = new Logger(AgentConfigController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly registry: AgentConfigRegistryService,
  ) {}

  @Get('agents')
  @ApiOperation({ summary: 'List all supported agent CLI tools' })
  @ApiResponse({ status: 200, description: 'List of supported agent IDs' })
  listAgents(): { agents: string[]; count: number } {
    return {
      agents: this.registry.supportedAgents(),
      count: this.registry.count(),
    };
  }

  @Get('agents/:id/detect')
  @ApiOperation({ summary: 'Detect if a specific agent CLI is installed' })
  @ApiResponse({ status: 200, type: DetectionResponseDto })
  async detectAgent(@Param('id') id: string): Promise<DetectionResponseDto> {
    const adapter = this.registry.getAdapter(id);
    if (!adapter) {
      return {
        agent: id,
        installed: false,
        binaryPath: null,
        configPath: 'N/A',
        configFound: false,
      };
    }

    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const result = await adapter.detect(homeDir);

    return {
      agent: id,
      ...result,
    };
  }

  @Get('agents/detect-all')
  @ApiOperation({ summary: 'Detect all supported agent CLI tools' })
  @ApiResponse({ status: 200, type: [DetectionResponseDto] })
  async detectAllAgents(): Promise<DetectionResponseDto[]> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const results = await this.registry.detectAll(homeDir);

    return results.map((r, i) => ({
      agent: this.registry.supportedAgents()[i],
      ...r,
    }));
  }

  @Post('install')
  @ApiOperation({ summary: 'Install Gentle AI ecosystem into selected agents' })
  @ApiResponse({ status: 200, description: 'Installation result' })
  async install(@Body() dto: InstallAgentDto) {
    this.logger.log(`Install request: agents=${dto.agents.join(', ')}, dryRun=${dto.dryRun ?? false}`);
    return this.commandBus.execute(
      new InstallAgentCommand(
        dto.agents,
        dto.components,
        dto.skills,
        dto.persona,
        dto.mcpServers,
        dto.dryRun,
      ),
    );
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync managed assets to current version' })
  @ApiResponse({ status: 200, description: 'Sync result' })
  async sync(@Body() dto: SyncAgentDto) {
    this.logger.log(`Sync request: agents=${dto.agents.join(', ')}`);
    return this.commandBus.execute(new SyncAgentCommand(dto.agents, dto.components));
  }

  @Get('skills')
  @ApiOperation({ summary: 'List available skills' })
  @ApiResponse({ status: 200, description: 'List of available skills' })
  async listSkills(): Promise<{ id: string; category: string }[]> {
    // Will be populated once assets are in place
    return [];
  }

  @Get('presets')
  @ApiOperation({ summary: 'List available presets' })
  @ApiResponse({ status: 200, description: 'List of available presets' })
  listPresets(): { id: string; name: string }[] {
    return [
      { id: 'full-gentleman', name: 'Full Gentleman' },
      { id: 'ecosystem-only', name: 'Ecosystem Only' },
      { id: 'minimal', name: 'Minimal' },
      { id: 'custom', name: 'Custom' },
    ];
  }

  @Post('update-claude-md')
  @ApiOperation({ summary: 'Actualiza la sección gentle-ai en ~/.claude/CLAUDE.md preservando contenido del usuario' })
  async updateClaudeMd(
    @Body() body: { targetPath?: string } = {},
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const result = await this.commandBus.execute(new UpdateClaudeMdCommand(body.targetPath));
      this.logger.log(`✅ CLAUDE.md updated via API | ${result.path}`);
      return { success: true, result };
    } catch (error) {
      this.logger.error(`❌ Failed to update CLAUDE.md: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
