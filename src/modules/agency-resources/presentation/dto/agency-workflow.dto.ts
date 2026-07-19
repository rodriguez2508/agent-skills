import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsIn,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAgencyWorkflowDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  @IsNotEmpty()
  steps!: any;

  @IsOptional()
  @IsIn(['sequential', 'parallel', 'conditional', 'event-driven'])
  triggerType?: string;

  @IsOptional()
  @IsObject()
  triggerConfig?: any;
}

export class UpdateAgencyWorkflowDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  steps?: any;

  @IsOptional()
  @IsIn(['sequential', 'parallel', 'conditional', 'event-driven'])
  triggerType?: string;

  @IsOptional()
  @IsObject()
  triggerConfig?: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
