import { Controller, Get, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AgentConfigRegistryService } from '@infrastructure/adapters/agent-config/agent-config-registry.service';
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
}
