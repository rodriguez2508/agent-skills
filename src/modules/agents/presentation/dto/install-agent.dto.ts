import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for installing the Gentle AI ecosystem into agents.
 */
export class InstallAgentDto {
  @ApiProperty({
    description: 'List of agent IDs to install into',
    example: ['qwen-cli', 'claude-code'],
  })
  @IsArray()
  @IsString({ each: true })
  agents: string[];

  @ApiPropertyOptional({
    description: 'Preset to use (full-gentleman, minimal, custom)',
    example: 'full-gentleman',
  })
  @IsOptional()
  @IsString()
  preset?: string;

  @ApiPropertyOptional({
    description: 'Components to install (sdd, skills, mcp, persona)',
    example: ['sdd', 'mcp'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  components?: string[];

  @ApiPropertyOptional({
    description: 'Individual skill IDs to install',
    example: ['go-testing', 'branch-pr'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({
    description: 'Persona to install',
    example: 'gentleman',
  })
  @IsOptional()
  @IsString()
  persona?: string;

  @ApiPropertyOptional({
    description: 'MCP servers to configure',
    example: { 'agent-skills-api': { url: 'http://localhost:8004/mcp/sse' } },
  })
  @IsOptional()
  mcpServers?: Record<string, Record<string, unknown>>;

  @ApiPropertyOptional({
    description: 'Preview plan without applying changes',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
