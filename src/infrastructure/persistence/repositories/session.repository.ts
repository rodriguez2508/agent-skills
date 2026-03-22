/**
 * Session Repository (TypeORM)
 * 
 * Handles session persistence with PostgreSQL.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session, SessionStatus } from '@infrastructure/database/typeorm/entities/session.entity';
import { ChatMessage, MessageRole } from '@infrastructure/database/typeorm/entities/chat-message.entity';

@Injectable()
export class SessionRepository {
  private readonly logger = new Logger(SessionRepository.name);

  constructor(
    @InjectRepository(Session)
    private readonly repository: Repository<Session>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
  ) {}

  /**
   * Get TypeORM repository for direct operations (NUEVO!)
   */
  getRepository(): Repository<Session> {
    return this.repository;
  }

  /**
   * Create a new session
   */
  async create(data: {
    sessionId: string;
    userId?: string;
    title?: string;
    metadata?: any;
  }): Promise<Session> {
    const session = this.repository.create({
      sessionId: data.sessionId,
      userId: data.userId,
      title: data.title,
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
    metadata?: any;
    tokenCount?: number;
  }): Promise<ChatMessage> {
    const session = await this.findBySessionId(data.sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${data.sessionId}`);
    }

    const message = this.messageRepository.create({
      sessionId: session.sessionId,
      role: data.role,
      content: data.content,
      metadata: data.metadata,
      tokenCount: data.tokenCount || 0,
    });

    const saved = await this.messageRepository.save(message);
    
    // Update session counters
    session.messageCount += 1;
    session.lastActivityAt = new Date();
    await this.repository.save(session);

    this.logger.debug(`💬 Message added to session ${session.id}`);
    return saved;
  }

  /**
   * Update session status
   */
  async updateStatus(sessionId: string, status: SessionStatus): Promise<Session> {
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
   * Get active sessions (for reuse)
   */
  async getActiveSessions(userId?: string): Promise<Session[]> {
    return this.repository.find({
      where: userId ? { userId, status: SessionStatus.ACTIVE } : { status: SessionStatus.ACTIVE },
      order: { createdAt: 'DESC' },
      take: 50,
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
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalMessages: number;
  }> {
    const [totalSessions, activeSessions] = await Promise.all([
      this.repository.count(),
      this.repository.count({ where: { status: SessionStatus.ACTIVE } }),
    ]);

    const totalMessages = await this.messageRepository.count();

    return {
      totalSessions,
      activeSessions,
      totalMessages,
    };
  }
}
