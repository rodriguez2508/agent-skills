import { ApiProperty } from '@nestjs/swagger';
import { Rule, RuleImpact } from '../../core/domain/entities/rule.entity';

export class RuleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  category: string;

  @ApiProperty({ isArray: true })
  tags: string[];

  @ApiProperty({ enum: RuleImpact })
  impact: RuleImpact;
}

export class RuleResultDto {
  @ApiProperty()
  rule: RuleResponseDto;

  @ApiProperty()
  score: number;
}

export class SearchRulesResponseDto {
  @ApiProperty({ type: [RuleResultDto] })
  results: RuleResultDto[];
}

export class ListRulesResponseDto {
  @ApiProperty({ type: [RuleResponseDto] })
  rules: RuleResponseDto[];
}
