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

export interface CreateContextDto {
  issueId: string;
  type: ContextType;
  summary?: string;
  messages?: any[];
  extractedInfo?: any;
  metadata?: any;
}

@Injectable()
export class ContextRepository {
  constructor(
    @InjectRepository(Context)
    private readonly repository: Repository<Context>,
  ) {}

  getRepository(): Repository<Context> {
    return this.repository;
  }

  async create(data: CreateContextDto): Promise<Context> {
    const contextId = `CTX-${Date.now()}`;

    const context = this.repository.create({
      contextId,
      issueId: data.issueId,
      type: data.type,
      summary: data.summary,
      messages: data.messages || [],
      extractedInfo: data.extractedInfo,
      metadata: data.metadata,
      isActive: true,
    });

    return await this.repository.save(context);
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
    await this.repository.update(id, { isActive: false });
  }

  async deactivateAllForIssue(issueId: string): Promise<void> {
    await this.repository.update(
      { issueId, isActive: true },
      { isActive: false },
    );
  }
}
