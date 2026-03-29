import { IsString, IsOptional } from 'class-validator';

/**
 * DTO para auto-detección de proyecto
 */
export class AutoDetectProjectDto {
  /**
   * Path absoluto al directorio del proyecto
   * Ejemplo: /home/user/my-project
   */
  @IsString()
  projectPath: string;
}

/**
 * DTO para creación de proyecto
 */
export class CreateProjectDto {
  /**
   * Nombre del proyecto
   */
  @IsString()
  name: string;

  /**
   * URL del repositorio (opcional)
   */
  @IsString()
  @IsOptional()
  repoUrl?: string;

  /**
   * Descripción del proyecto (opcional)
   */
  @IsString()
  @IsOptional()
  description?: string;
}
