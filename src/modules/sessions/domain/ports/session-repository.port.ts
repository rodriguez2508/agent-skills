/**
 * Session Repository Port
 */

import { SessionStatus } from '../entities/session.entity';

export interface CreateSessionDto {
  sessionId: string;
  userId?: string;
  projectId?: string; // ← NEW: Link to project
  title?: string;
  purpose?: string | null; // Specific goal/issue for this session
  purposeId?: string; // Foreign key to session_purposes
  metadata?: any;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  totalMessages: number;
}

export abstract class ISessionRepository {
  abstract create(data: CreateSessionDto): Promise<any>;

  abstract findBySessionId(sessionId: string): Promise<any | null>;

  abstract findById(id: string): Promise<any | null>;

  abstract findByUserId(userId: string, limit?: number): Promise<any[]>;

  abstract getActiveSessions(userId?: string): Promise<any[]>;

  abstract getRecentSessions(limit?: number): Promise<any[]>;

  abstract addMessage(data: {
    sessionId: string;
    role: string;
    content: string;
    metadata?: any;
    tokenCount?: number;
  }): Promise<any>;

  abstract updateStatus(
    sessionId: string,
    status: SessionStatus,
  ): Promise<any>;

  abstract close(sessionId: string): Promise<any>;

  abstract delete(sessionId: string): Promise<void>;

  abstract getStats(): Promise<SessionStats>;
}
