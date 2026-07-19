import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchRulesDto {
  @ApiProperty({ description: 'Search query', example: 'CQRS pattern' })
  query: string;

  @ApiPropertyOptional({ description: 'Filter by category', example: 'nestjs' })
  category?: string;

  @ApiPropertyOptional({ description: 'Maximum results', example: 10 })
  limit?: number;
}
