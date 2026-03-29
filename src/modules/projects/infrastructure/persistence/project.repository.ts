/**
 * Project Repository
 *
 * Handles persistence operations for Project entities.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '@modules/projects/domain/entities/project.entity';

export interface CreateProjectDto {
  name: string;
  repoUrl?: string;
  description?: string;
  userId?: string;
  metadata?: {
    language?: string;
    framework?: string;
    [key: string]: any;
  };
}

@Injectable()
export class ProjectRepository {
  constructor(
    @InjectRepository(Project)
    private readonly repository: Repository<Project>,
  ) {}

  getRepository(): Repository<Project> {
    return this.repository;
  }

  async create(data: CreateProjectDto): Promise<Project> {
    const project = this.repository.create({
      name: data.name,
      repoUrl: data.repoUrl,
      description: data.description,
      userId: data.userId,
      metadata: data.metadata,
      isActive: true,
      defaultBranch: 'main',
    });

    return await this.repository.save(project);
  }

  async findById(id: string): Promise<Project | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['user', 'sessions', 'issues'],
    });
  }

  async findByName(name: string): Promise<Project | null> {
    return this.repository.findOne({
      where: { name },
      relations: ['user'],
    });
  }

  async findByUserId(userId: string): Promise<Project[]> {
    return this.repository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOrCreate(data: CreateProjectDto): Promise<Project> {
    const existing = await this.findByName(data.name);
    if (existing) {
      return existing;
    }
    return this.create(data);
  }

  async update(id: string, data: Partial<Project>): Promise<Project | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async deactivate(id: string): Promise<void> {
    await this.repository.update(id, { isActive: false });
  }
}
