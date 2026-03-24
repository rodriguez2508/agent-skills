/**
 * Session Purpose Repository
 *
 * Handles persistence operations for SessionPurpose entities.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull, Not, LessThanOrEqual } from 'typeorm';
import { SessionPurpose, SessionPurposeStatus } from '@modules/sessions/domain/entities/session-purpose.entity';

export interface CreateSessionPurposeDto {
  userId?: string;
  title: string;
  description?: string;
  initialSessionId?: string;
  metadata?: {
    category?: string;
    tags?: string[];
    [key: string]: any;
  };
}

export interface FindSessionPurposesFilters {
  userId?: string;
  status?: SessionPurposeStatus;
  category?: string;
  search?: string;
}

@Injectable()
export class SessionPurposeRepository {
  constructor(
    @InjectRepository(SessionPurpose)
    private readonly repository: Repository<SessionPurpose>,
  ) {}

  getRepository(): Repository<SessionPurpose> {
    return this.repository;
  }

  /**
   * Creates a new session purpose
   */
  async create(data: CreateSessionPurposeDto): Promise<SessionPurpose> {
    const purpose = this.repository.create({
      ...data,
      status: SessionPurposeStatus.ACTIVE,
      sessionCount: 1,
      lastActivityAt: new Date(),
      lastSessionId: data.initialSessionId,
    });

    return await this.repository.save(purpose);
  }

  /**
   * Finds a purpose by ID
   */
  async findById(id: string): Promise<SessionPurpose | null> {
    return await this.repository.findOne({
      where: { id },
    });
  }

  /**
   * Finds purposes by user ID
   */
  async findByUserId(userId: string, filters?: FindSessionPurposesFilters): Promise<SessionPurpose[]> {
    const where: any = { userId };

    if (filters?.status) {
      where.status = filters.status;
    }

    return await this.repository.find({
      where,
      order: { lastActivityAt: 'DESC' },
      take: 50,
    });
  }

  /**
   * Searches purposes by title or description
   */
  async search(userIds: string[], searchTerm: string, limit: number = 10): Promise<SessionPurpose[]> {
    return await this.repository.find({
      where: [
        {
          userId: Like(userIds[0] || '%'),
          status: SessionPurposeStatus.ACTIVE,
          title: Like(`%${searchTerm}%`),
        },
        {
          userId: Like(userIds[0] || '%'),
          status: SessionPurposeStatus.ACTIVE,
          description: Like(`%${searchTerm}%`),
        },
      ],
      order: { lastActivityAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Finds active purposes for a user
   */
  async findActiveByUserId(userId: string): Promise<SessionPurpose[]> {
    return await this.repository.find({
      where: {
        userId,
        status: SessionPurposeStatus.ACTIVE,
      },
      order: { lastActivityAt: 'DESC' },
    });
  }

  /**
   * Updates the last session reference for a purpose
   */
  async updateLastSession(purposeId: string, sessionId: string): Promise<void> {
    await this.repository.update(purposeId, {
      lastSessionId: sessionId,
      lastActivityAt: new Date(),
    });
  }

  /**
   * Increments session count for a purpose
   */
  async incrementSessionCount(purposeId: string): Promise<void> {
    await this.repository.increment({ id: purposeId }, 'sessionCount', 1);
    await this.repository.update(purposeId, {
      lastActivityAt: new Date(),
    });
  }

  /**
   * Marks a purpose as completed
   */
  async complete(purposeId: string): Promise<void> {
    await this.repository.update(purposeId, {
      status: SessionPurposeStatus.COMPLETED,
      completedAt: new Date(),
    });
  }

  /**
   * Marks a purpose as abandoned
   */
  async abandon(purposeId: string): Promise<void> {
    await this.repository.update(purposeId, {
      status: SessionPurposeStatus.ABANDONED,
    });
  }

  /**
   * Gets statistics about session purposes
   */
  async getStats(userId?: string): Promise<{
    total: number;
    active: number;
    completed: number;
    abandoned: number;
  }> {
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }

    const [total, active, completed, abandoned] = await Promise.all([
      this.repository.count({ where }),
      this.repository.count({ where: { ...where, status: SessionPurposeStatus.ACTIVE } }),
      this.repository.count({ where: { ...where, status: SessionPurposeStatus.COMPLETED } }),
      this.repository.count({ where: { ...where, status: SessionPurposeStatus.ABANDONED } }),
    ]);

    return { total, active, completed, abandoned };
  }

  /**
   * Finds purposes that haven't had activity for a while
   */
  async findInactiveSince(thresholdDate: Date): Promise<SessionPurpose[]> {
    return await this.repository.find({
      where: {
        status: SessionPurposeStatus.ACTIVE,
        lastActivityAt: thresholdDate,
      },
    });
  }

  /**
   * Updates the context and next steps for a purpose
   * This allows tracking conversation progress and planning future interactions
   */
  async updateContext(
    purposeId: string,
    context: {
      currentContext?: string;
      nextSteps?: string[];
      keyDecisions?: string[];
      openQuestions?: string[];
      [key: string]: any;
    },
  ): Promise<void> {
    const purpose = await this.repository.findOne({ where: { id: purposeId } });
    if (!purpose) return;

    // Merge existing metadata with new context
    const updatedMetadata = {
      ...purpose.metadata,
      ...context,
      lastUpdatedAt: new Date().toISOString(),
    };

    await this.repository.update(purposeId, {
      metadata: updatedMetadata as any,
      lastActivityAt: new Date(),
    });
  }

  /**
   * Adds a key decision to the purpose's metadata
   */
  async addKeyDecision(purposeId: string, decision: string): Promise<void> {
    const purpose = await this.repository.findOne({ where: { id: purposeId } });
    if (!purpose) return;

    const decisions = purpose.metadata?.keyDecisions || [];
    decisions.push(decision);

    await this.repository.update(purposeId, {
      metadata: {
        ...purpose.metadata,
        keyDecisions: decisions,
        lastUpdatedAt: new Date().toISOString(),
      } as any,
      lastActivityAt: new Date(),
    });
  }

  /**
   * Adds next steps to the purpose's metadata
   */
  async addNextSteps(purposeId: string, steps: string[]): Promise<void> {
    const purpose = await this.repository.findOne({ where: { id: purposeId } });
    if (!purpose) return;

    const existingSteps = purpose.metadata?.nextSteps || [];
    const updatedSteps = [...existingSteps, ...steps];

    await this.repository.update(purposeId, {
      metadata: {
        ...purpose.metadata,
        nextSteps: updatedSteps,
        lastUpdatedAt: new Date().toISOString(),
      } as any,
      lastActivityAt: new Date(),
    });
  }
}
