/**
 * Project Service
 *
 * Application service for managing projects.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ProjectRepository,
  CreateProjectDto,
} from '../../infrastructure/persistence/project.repository';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(private readonly projectRepository: ProjectRepository) {}

  async createProject(data: CreateProjectDto) {
    this.logger.log(`📁 Creating project: ${data.name}`);

    const project = await this.projectRepository.create(data);

    this.logger.log(`✅ Project created: ${project.id} (${project.name})`);

    return {
      id: project.id,
      name: project.name,
      repoUrl: project.repoUrl,
      description: project.description,
      isActive: project.isActive,
      defaultBranch: project.defaultBranch,
      metadata: project.metadata,
      createdAt: project.createdAt,
    };
  }

  async getProjectById(id: string) {
    return this.projectRepository.findById(id);
  }

  async getProjectByName(name: string) {
    return this.projectRepository.findByName(name);
  }

  async getProjectsByUser(userId: string) {
    return this.projectRepository.findByUserId(userId);
  }

  async findOrCreateProject(data: CreateProjectDto) {
    this.logger.log(`📁 Finding or creating project: ${data.name}`);

    const project = await this.projectRepository.findOrCreate(data);

    this.logger.log(
      `✅ Project found/created: ${project.id} (${project.name})`,
    );

    return {
      id: project.id,
      name: project.name,
      repoUrl: project.repoUrl,
      description: project.description,
      isActive: project.isActive,
      defaultBranch: project.defaultBranch,
      metadata: project.metadata,
      createdAt: project.createdAt,
    };
  }

  async updateProject(id: string, data: Partial<CreateProjectDto>) {
    return this.projectRepository.update(id, data);
  }

  async detectProjectFromPath(filePath: string): Promise<string | null> {
    // Simple detection: extract project name from path
    // e.g., /home/aajcr/PROYECTOS/linki-f -> linki-f
    const parts = filePath.split('/');
    const possibleProjectNames = [
      'linki-f',
      'agent-skills-api',
      'midas-server',
    ];

    for (const part of parts) {
      if (possibleProjectNames.includes(part)) {
        return part;
      }
    }

    // Return last meaningful segment
    const meaningfulParts = parts.filter(
      (p) =>
        p &&
        !p.includes('home') &&
        !p.includes('aajcr') &&
        !p.includes('PROYECTOS'),
    );

    return meaningfulParts[meaningfulParts.length - 1] || null;
  }
}
