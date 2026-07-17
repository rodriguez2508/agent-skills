import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for agent detection result.
 */
export class DetectionResponseDto {
  @ApiProperty({ description: 'Agent ID' })
  agent: string;

  @ApiProperty({ description: 'Whether the agent binary is installed' })
  installed: boolean;

  @ApiProperty({ description: 'Path to the binary, or null', nullable: true })
  binaryPath: string | null;

  @ApiProperty({ description: 'Expected config directory path' })
  configPath: string;

  @ApiProperty({ description: 'Whether the config directory was found' })
  configFound: boolean;

  @ApiProperty({ description: 'Agent version, if detected', nullable: true })
  version?: string;
}
