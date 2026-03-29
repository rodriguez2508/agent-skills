import { IsString, IsOptional, IsObject, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para crear issue
 */
export class CreateIssueDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  requirements?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsObject()
  @IsOptional()
  context?: any;

  @IsObject()
  @IsOptional()
  metadata?: any;
}

/**
 * DTO para añadir interacción
 */
export class AddInteractionDto {
  @IsString()
  role: 'user' | 'agent' | 'system';

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  agentId?: string;

  @IsObject()
  @IsOptional()
  metadata?: any;
}

/**
 * DTO para añadir decisión clave
 */
export class AddKeyDecisionDto {
  @IsString()
  decision: string;

  @IsString()
  rationale: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  alternatives?: string[];

  @IsString()
  @IsOptional()
  agentId?: string;
}

/**
 * DTO para añadir modificación de archivo
 */
export class AddFileModificationDto {
  @IsString()
  path: string;

  @IsString()
  action: 'create' | 'modify' | 'delete';

  @IsOptional()
  linesAdded?: number;

  @IsOptional()
  linesRemoved?: number;

  @IsString()
  @IsOptional()
  diff?: string;
}

/**
 * DTO para actualizar snapshot del proyecto
 */
export class UpdateProjectSnapshotDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  version?: string;

  @IsObject()
  @IsOptional()
  dependencies?: Record<string, string>;

  @IsString()
  @IsOptional()
  detectedFramework?: string;

  @IsString()
  @IsOptional()
  detectedArchitecture?: string;

  @IsString()
  @IsOptional()
  language?: string;
}
