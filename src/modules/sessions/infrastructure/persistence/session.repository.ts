/**
 * Session Repository (TypeORM Implementation)
 *
 * Handles session persistence with PostgreSQL.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Session, SessionStatus } from '../../domain/entities/session.entity';
import {
  ChatMessage,
  MessageRole,
} from '../../domain/entities/chat-message.entity';
import {
  ISessionRepository,
  CreateSessionDto,
  SessionStats,
} from '../../domain/ports/session-repository.port';

@Injectable()
export class SessionRepository implements ISessionRepository {
  private readonly logger = new Logger(SessionRepository.name);

  constructor(
    @InjectRepository(Session)
    private readonly repository: Repository<Session>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
  ) {}

  /**
   * Get TypeORM repository for direct operations
   */
  getRepository(): Repository<Session> {
    return this.repository;
  }

  /**
   * Create a new session
   */
  async create(data: CreateSessionDto): Promise<Session> {
    const session = this.repository.create({
      sessionId: data.sessionId,
      userId: data.userId || undefined,
      projectId: data.projectId || undefined, // ← NEW: Link to project
      issueId: (data as any).issueId || undefined, // Will be added to CreateSessionDto later
      title: data.title,
      isValidated: false,
      metadata: data.metadata,
      status: SessionStatus.ACTIVE,
      messageCount: 0,
      lastActivityAt: new Date(),
    });

    const saved = await this.repository.save(session);
    this.logger.debug(`📝 Session created: ${saved.id}`);
    return saved;
  }

  /**
   * Find session by external session ID
   */
  async findBySessionId(sessionId: string): Promise<Session | null> {
    return this.repository.findOne({
      where: { sessionId },
    });
  }

  /**
   * Find session by internal ID
   */
  async findById(id: string): Promise<Session | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['messages'],
    });
  }

  /**
   * Find sessions by user ID
   */
  async findByUserId(userId: string, limit = 50): Promise<Session[]> {
    return this.repository.find({
      where: { userId, status: SessionStatus.ACTIVE },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  /**
   * Find active session by user ID that is validated (has meaningful interaction)
   */
  async findValidatedSessionByUserId(userId: string): Promise<Session | null> {
    return this.repository.findOne({
      where: {
        userId,
        status: SessionStatus.ACTIVE,
        isValidated: true,
      },
      order: { lastActivityAt: 'DESC' },
    });
  }

  /**
   * Find unvalidated sessions older than a threshold
   */
  async findUnvalidatedSessionsOlderThan(threshold: Date): Promise<Session[]> {
    return this.repository.find({
      where: {
        isValidated: false,
        createdAt: LessThanOrEqual(threshold),
        status: SessionStatus.ACTIVE,
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Find inactive sessions (no activity since threshold)
   */
  async findInactiveSessionsSince(threshold: Date): Promise<Session[]> {
    return this.repository.find({
      where: {
        status: SessionStatus.ACTIVE,
        lastActivityAt: LessThanOrEqual(threshold),
      },
      order: { lastActivityAt: 'ASC' },
    });
  }

  /**
   * Get all messages for a session
   */
  async getMessages(sessionId: string, limit = 50): Promise<ChatMessage[]> {
    return this.messageRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * Add a message to a session
   */
  async addMessage(data: {
    sessionId: string;
    role: MessageRole;
    content: string;
    issueId?: string; // NEW: Link message to specific issue
    metadata?: any;
    tokenCount?: number;
  }): Promise<ChatMessage> {
    const session = await this.findBySessionId(data.sessionId);

    if (!session) {
      throw new Error(`Session not found: ${data.sessionId}`);
    }

    // Check if session is still active
    if (session.status !== SessionStatus.ACTIVE) {
      throw new Error(
        `Session is not active: ${data.sessionId} (status: ${session.status})`,
      );
    }

    const message = this.messageRepository.create({
      sessionId: session.sessionId,
      role: data.role,
      content: data.content,
      metadata: data.metadata,
      tokenCount: data.tokenCount || 0,
    });

    // Set issueId separately to avoid type issues
    if (data.issueId) {
      message.issueId = data.issueId;
    }

    const saved = await this.messageRepository.save(message);

    // Update session counters
    session.messageCount += 1;
    session.lastActivityAt = new Date();

    // Validate session on first message (first meaningful interaction)
    if (!session.isValidated) {
      session.isValidated = true;
      session.validatedAt = new Date();
      this.logger.debug(`✅ Session validated: ${session.id}`);
    }

    await this.repository.save(session);

    this.logger.debug(`💬 Message added to session ${session.id}`);
    return saved;
  }

  /**
   * Update session status
   */
  async updateStatus(
    sessionId: string,
    status: SessionStatus,
  ): Promise<Session> {
    await this.repository.update({ sessionId }, { status });
    const updated = await this.findBySessionId(sessionId);

    if (!updated) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.logger.debug(`📊 Session status updated: ${status}`);
    return updated;
  }

  /**
   * Close a session
   */
  async close(sessionId: string): Promise<Session> {
    return this.updateStatus(sessionId, SessionStatus.ENDED);
  }

  /**
   * Invalidate a session (mark as invalid)
   */
  async invalidate(sessionId: string, reason?: string): Promise<Session> {
    await this.repository.update(
      { sessionId },
      {
        status: SessionStatus.INVALID,
        metadata: () =>
          `metadata || '{}'::jsonb || '{"invalidReason": "${reason || 'No reason provided'}"}'::jsonb`,
      },
    );
    const updated = await this.findBySessionId(sessionId);

    if (!updated) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.logger.warn(
      `🚫 Session invalidated: ${sessionId}${reason ? ` - ${reason}` : ''}`,
    );
    return updated;
  }

  /**
   * Expire a session (timeout due to inactivity)
   */
  async expire(sessionId: string): Promise<Session> {
    await this.repository.update(
      { sessionId },
      { status: SessionStatus.EXPIRED },
    );
    const updated = await this.findBySessionId(sessionId);

    if (!updated) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.logger.debug(`⏰ Session expired: ${sessionId}`);
    return updated;
  }

  /**
   * Get active sessions (for reuse)
   */
  async getActiveSessions(userId?: string): Promise<Session[]> {
    return this.repository.find({
      where: userId
        ? { userId, status: SessionStatus.ACTIVE }
        : { status: SessionStatus.ACTIVE },
      order: { createdAt: 'DESC' },
      take: 50,
      relations: ['user'],
    });
  }

  /**
   * Get validated active sessions (sessions with meaningful interactions)
   */
  async getValidatedActiveSessions(userId?: string): Promise<Session[]> {
    return this.repository.find({
      where: userId
        ? { userId, status: SessionStatus.ACTIVE, isValidated: true }
        : { status: SessionStatus.ACTIVE, isValidated: true },
      order: { lastActivityAt: 'DESC' },
      take: 10,
    });
  }

  /**
   * Get unvalidated sessions (candidates for cleanup)
   */
  async getUnvalidatedSessions(): Promise<Session[]> {
    return this.repository.find({
      where: { status: SessionStatus.ACTIVE, isValidated: false },
      order: { createdAt: 'ASC' },
      take: 100,
    });
  }

  /**
   * Get recent sessions (for analytics)
   */
  async getRecentSessions(limit = 20): Promise<Session[]> {
    return this.repository.find({
      where: { status: SessionStatus.ACTIVE },
      order: { lastActivityAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  /**
   * Delete a session and all its messages
   */
  async delete(sessionId: string): Promise<void> {
    const session = await this.findBySessionId(sessionId);

    if (session) {
      await this.repository.remove(session);
      this.logger.debug(`🗑️ Session deleted: ${session.id}`);
    }
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<SessionStats> {
    const [totalSessions, activeSessions, expiredSessions] = await Promise.all([
      this.repository.count(),
      this.repository.count({ where: { status: SessionStatus.ACTIVE } }),
      this.repository.count({ where: { status: SessionStatus.EXPIRED } }),
    ]);

    const totalMessages = await this.messageRepository.count();

    return {
      totalSessions,
      activeSessions,
      expiredSessions,
      totalMessages,
    };
  }
}
