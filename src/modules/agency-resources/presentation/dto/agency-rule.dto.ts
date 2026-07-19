import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsInt,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAgencyRuleDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['guardrail', 'policy', 'quality', 'workflow', 'custom'])
  category?: string;

  @IsString()
  @IsNotEmpty()
  ruleContent!: string;

  @IsOptional()
  @IsIn(['soft', 'hard'])
  enforcementLevel?: string;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class UpdateAgencyRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['guardrail', 'policy', 'quality', 'workflow', 'custom'])
  category?: string;

  @IsOptional()
  @IsString()
  ruleContent?: string;

  @IsOptional()
  @IsIn(['soft', 'hard'])
  enforcementLevel?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
