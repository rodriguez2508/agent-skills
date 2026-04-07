import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '@modules/projects/domain/entities/project.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Resultado de la detección de proyecto desde package.json
 */
export interface ProjectDetection {
  name: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  detectedFramework?: string;
  detectedArchitecture?: string;
}

/**
 * Servicio de proyectos para gestión y detección automática
 *
 * Características:
 * - Detección automática desde package.json
 * - Identificación de framework (Angular, NestJS, React, Vue)
 * - Múltiples proyectos por usuario
 */
@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  /**
   * Detecta proyecto desde package.json en un directorio dado
   *
   * @param projectPath - Path absoluto al directorio del proyecto
   * @returns Información detectada o null si no hay package.json
   */
  async detectFromPath(projectPath: string): Promise<ProjectDetection | null> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      return {
        name: packageJson.name || 'unknown-project',
        version: packageJson.version,
        dependencies: packageJson.dependencies,
        devDependencies: packageJson.devDependencies,
        scripts: packageJson.scripts,
        detectedFramework: this.detectFramework(packageJson),
        detectedArchitecture: await this.detectArchitecture(projectPath),
      };
    } catch (error) {
      // package.json no encontrado o inválido
      return null;
    }
  }

  /**
   * Encuentra o crea proyecto para un usuario
   *
   * @param userId - ID del usuario
   * @param projectName - Nombre del proyecto
   * @param projectPath - Path opcional para detectar metadata
   * @returns Proyecto encontrado o creado
   */
  async findOrCreateForUser(
    userId: string,
    projectName: string,
    projectPath?: string,
  ): Promise<Project> {
    let project = await this.projectRepository.findOne({
      where: { name: projectName, userId },
    });

    if (!project) {
      project = this.projectRepository.create({
        name: projectName,
        userId,
        isActive: true,
        defaultBranch: 'main',
      });

      // Si hay path, detectar metadata
      if (projectPath) {
        const detection = await this.detectFromPath(projectPath);
        if (detection) {
          project.metadata = {
            language: this.detectLanguage(detection),
            framework: detection.detectedFramework,
            lastAnalyzedAt: new Date().toISOString(),
          };
        }
      }

      await this.projectRepository.save(project);
    }

    return project;
  }

  /**
   * Detecta framework basado en dependencias del package.json
   */
  private detectFramework(packageJson: any): string {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (deps['@angular/core']) return 'angular';
    if (deps['@nestjs/common']) return 'nestjs';
    if (deps['react']) return 'react';
    if (deps['vue']) return 'vue';
    if (deps['express']) return 'node-express';
    if (deps['fastify']) return 'node-fastify';
    if (deps['@nestjs/core']) return 'nestjs';
    if (deps['next']) return 'nextjs';
    if (deps['nuxt']) return 'nuxtjs';
    if (deps['svelte']) return 'svelte';

    return 'node';
  }

  /**
   * Detecta arquitectura basada en estructura de archivos
   *
   * @param projectPath - Path al proyecto
   * @returns Arquitectura detectada
   */
  private async detectArchitecture(projectPath: string): Promise<string> {
    try {
      // Verificar existencia de directorios característicos
      const dirs = await fs.readdir(projectPath);

      // Clean Architecture / Hexagonal
      if (
        dirs.includes('domain') ||
        dirs.includes('application') ||
        dirs.includes('infrastructure')
      ) {
        return 'hexagonal';
      }

      // NestJS default structure
      if (dirs.includes('src') && dirs.includes('test')) {
        return 'nestjs';
      }

      // Angular default structure
      if (dirs.includes('e2e') && dirs.includes('src')) {
        return 'angular';
      }

      return 'standard';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Detecta lenguaje principal del proyecto
   */
  private detectLanguage(detection: ProjectDetection): string {
    if (
      detection.detectedFramework === 'angular' ||
      detection.detectedFramework === 'nestjs'
    ) {
      return 'TypeScript';
    }

    const hasTs = detection.dependencies?.['typescript'];
    const hasJs = detection.dependencies?.['@babel/core'];

    if (hasTs) return 'TypeScript';
    if (hasJs) return 'JavaScript';

    return 'Unknown';
  }

  /**
   * Obtiene todos los proyectos de un usuario
   */
  async findByUser(userId: string): Promise<Project[]> {
    return this.projectRepository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtiene proyecto por ID
   */
  async findById(id: string): Promise<Project | null> {
    return this.projectRepository.findOne({ where: { id } });
  }

  /**
   * Actualiza metadata del proyecto (análisis)
   */
  async updateMetadata(
    projectId: string,
    metadata: Partial<Project['metadata']>,
  ): Promise<Project> {
    const project = await this.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    project.metadata = { ...project.metadata, ...metadata };
    return await this.projectRepository.save(project);
  }

  /**
   * Marca proyecto como inactivo (soft delete)
   */
  async deactivate(projectId: string): Promise<void> {
    await this.projectRepository.update(projectId, { isActive: false });
  }

  /**
   * Encuentra o crea proyecto con datos proporcionados
   * Usado por McpService cuando no hay path al proyecto
   */
  async findOrCreateProject(data: {
    name: string;
    userId: string;
    metadata?: any;
  }): Promise<Project> {
    let project = await this.projectRepository.findOne({
      where: { name: data.name, userId: data.userId },
    });

    if (!project) {
      project = this.projectRepository.create({
        name: data.name,
        userId: data.userId,
        isActive: true,
        defaultBranch: 'main',
        metadata: data.metadata,
      });

      await this.projectRepository.save(project);
    }

    return project;
  }
}
