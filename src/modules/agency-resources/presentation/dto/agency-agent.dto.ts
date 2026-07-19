import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsIn,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAgencyAgentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  systemPrompt!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tools?: string[];

  @IsOptional()
  @IsIn(['conversational', 'task', 'hybrid'])
  type?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ruleIds?: string[];
}

export class UpdateAgencyAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tools?: string[];

  @IsOptional()
  @IsIn(['conversational', 'task', 'hybrid'])
  type?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ruleIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
