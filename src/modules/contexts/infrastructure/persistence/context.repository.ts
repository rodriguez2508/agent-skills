/**
 * Context Repository
 *
 * Handles persistence operations for Context entities.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Context,
  ContextType,
} from '@modules/contexts/domain/entities/context.entity';
import { RedisService } from '@infrastructure/database/redis/redis.service';

export interface CreateContextDto {
  issueId?: string;
  projectId?: string;
  type: ContextType;
  summary?: string;
  messages?: any[];
  extractedInfo?: any;
  metadata?: any;
}

@Injectable()
export class ContextRepository {
  private static MEMORY_CACHE_TTL = 300;

  constructor(
    @InjectRepository(Context)
    private readonly repository: Repository<Context>,
    private readonly redisService: RedisService,
  ) {}

  getRepository(): Repository<Context> {
    return this.repository;
  }

  async create(data: CreateContextDto): Promise<Context> {
    const contextId = `CTX-${Date.now()}`;

    const context = this.repository.create({
      contextId,
      issueId: data.issueId,
      projectId: data.projectId,
      type: data.type,
      summary: data.summary,
      messages: data.messages || [],
      extractedInfo: data.extractedInfo,
      metadata: data.metadata,
      isActive: true,
    });

    const saved = await this.repository.save(context);
    if (data.projectId) await this.invalidateCache(data.projectId);
    return saved;
  }

  async findByProjectId(projectId: string, type?: ContextType): Promise<Context[]> {
    const cacheKey = `memory:${projectId}${type ? `:${type}` : ''}`;

    const cached = await this.redisService.cacheGet<Context[]>(cacheKey);
    if (cached) return cached;

    const where: any = { projectId, isActive: true };
    if (type) where.type = type;
    const results = await this.repository.find({ where, order: { createdAt: 'DESC' } });

    await this.redisService.cacheSet(cacheKey, results, ContextRepository.MEMORY_CACHE_TTL);
    return results;
  }

  async findById(id: string): Promise<Context | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['issue'],
    });
  }

  async findByIssueId(issueId: string, activeOnly = true): Promise<Context[]> {
    const where: any = { issueId };
    if (activeOnly) {
      where.isActive = true;
    }
    return this.repository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveByIssueId(issueId: string): Promise<Context | null> {
    return this.repository.findOne({
      where: { issueId, isActive: true },
      order: { updatedAt: 'DESC' },
    });
  }

  async update(id: string, data: Partial<Context>): Promise<Context | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async addMessage(
    id: string,
    message: { role: 'user' | 'assistant' | 'system'; content: string },
  ) {
    const context = await this.findById(id);
    if (!context) return null;

    const messages = context.messages || [];
    messages.push({
      ...message,
      timestamp: new Date().toISOString(),
    });

    await this.repository.update(id, {
      messages,
      metadata: {
        ...context.metadata,
        lastMessageAt: new Date().toISOString(),
        messageCount: messages.length,
      } as any,
    });

    return this.findById(id);
  }

  async deactivate(id: string): Promise<void> {
    const context = await this.findById(id);
    await this.repository.update(id, { isActive: false });
    if (context?.projectId) await this.invalidateCache(context.projectId);
  }

  async deactivateAllForIssue(issueId: string): Promise<void> {
    await this.repository.update(
      { issueId, isActive: true },
      { isActive: false },
    );
  }

  async deleteById(id: string): Promise<void> {
    const context = await this.repository.findOne({ where: { id } });
    if (context) {
      await this.repository.remove(context);
      if (context.projectId) {
        await this.invalidateCache(context.projectId);
      }
    }
  }

  private async invalidateCache(projectId: string): Promise<void> {
    await this.redisService.cacheDelete(`memory:${projectId}`);
  }
}
