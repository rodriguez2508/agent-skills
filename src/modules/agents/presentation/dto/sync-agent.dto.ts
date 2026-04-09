import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for syncing managed assets to current version.
 */
export class SyncAgentDto {
  @ApiProperty({
    description: 'List of agent IDs to sync',
    example: ['qwen-cli', 'claude-code'],
  })
  @IsArray()
  @IsString({ each: true })
  agents: string[];

  @ApiPropertyOptional({
    description: 'Components to sync (default: all)',
    example: ['sdd'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  components?: string[];
}
