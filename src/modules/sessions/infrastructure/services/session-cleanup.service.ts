/**
 * Session Cleanup Service
 *
 * Periodically cleans up invalid, expired, and orphaned sessions.
 * Runs every 5 minutes by default using @nestjs/schedule.
 *
 * Cleanup rules:
 * - Unvalidated sessions older than 5 minutes → EXPIRED
 * - Inactive sessions (no activity for 24 hours) → EXPIRED (unless has active purpose)
 * - Expired sessions WITHOUT purpose → DELETED immediately
 * - Expired sessions WITH purpose older than 7 days → DELETED
 * - Sessions with ACTIVE PURPOSE are protected from expiration
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionRepository } from '@modules/sessions/infrastructure/persistence/session.repository';
import { SessionPurposeRepository } from '@infrastructure/persistence/repositories/session-purpose.repository';
import { SessionStatus } from '@modules/sessions/domain/entities/session.entity';
import { SessionPurposeStatus } from '@modules/sessions/domain/entities/session-purpose.entity';
import { LessThanOrEqual, IsNull, Not, In } from 'typeorm';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  // Configuration
  private readonly UNVALIDATED_SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly INACTIVE_SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly EXPIRED_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly sessionPurposeRepository: SessionPurposeRepository,
  ) {
    this.logger.log('🗑️ SessionCleanupService initialized');
  }

  /**
   * Main cleanup routine - runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async performCleanup(): Promise<void> {
    this.logger.debug('🧹 Starting session cleanup...');

    const now = new Date();
    let cleanedCount = 0;

    try {
      // Get all active purposes to protect their sessions
      const activePurposes = await this.sessionPurposeRepository.getRepository().find({
        where: { status: SessionPurposeStatus.ACTIVE },
        select: ['id', 'lastSessionId', 'initialSessionId'],
      });

      const protectedSessionIds = new Set<string>(
        activePurposes.flatMap(p => [p.lastSessionId, p.initialSessionId].filter(Boolean) as string[])
      );

      this.logger.debug(`🛡️ Protecting ${protectedSessionIds.size} sessions with active purposes`);

      // 1. Expire unvalidated sessions older than 5 minutes (except protected ones)
      const unvalidatedThreshold = new Date(now.getTime() - this.UNVALIDATED_SESSION_TIMEOUT_MS);
      const unvalidatedSessions = await this.sessionRepository.findUnvalidatedSessionsOlderThan(unvalidatedThreshold);

      for (const session of unvalidatedSessions) {
        // Skip if session is protected by active purpose
        if (protectedSessionIds.has(session.sessionId)) {
          this.logger.debug(`🛡️ Skipping protected session: ${session.sessionId}`);
          continue;
        }

        await this.sessionRepository.expire(session.sessionId);
        cleanedCount++;
        this.logger.debug(`⏰ Expired unvalidated session: ${session.sessionId} (age: ${this.getAge(session.createdAt)})`);
      }

      if (unvalidatedSessions.length > 0) {
        this.logger.log(`✅ Expired ${unvalidatedSessions.length} unvalidated session(s)`);
      }

      // 2. Expire inactive sessions (no activity for 24 hours)
      // Sessions with active purposes are protected
      const inactiveThreshold = new Date(now.getTime() - this.INACTIVE_SESSION_TIMEOUT_MS);
      const inactiveSessions = await this.sessionRepository.findInactiveSessionsSince(inactiveThreshold);

      for (const session of inactiveSessions) {
        // Skip if session is protected by active purpose
        if (protectedSessionIds.has(session.sessionId)) {
          this.logger.debug(`🛡️ Skipping protected inactive session: ${session.sessionId} (purpose active)`);
          continue;
        }

        // Don't expire sessions that have recent messages
        if (session.lastActivityAt && session.lastActivityAt < inactiveThreshold) {
          await this.sessionRepository.expire(session.sessionId);
          cleanedCount++;
          this.logger.debug(`⏰ Expired inactive session: ${session.sessionId} (last activity: ${this.getAge(session.lastActivityAt)})`);
        }
      }

      if (inactiveSessions.length > 0) {
        this.logger.log(`✅ Expired ${inactiveSessions.length} inactive session(s) (protected: ${protectedSessionIds.size})`);
      }

      // 3. Delete expired sessions without purpose (immediate cleanup)
      const expiredSessionsNoPurpose = await this.sessionRepository.getRepository().find({
        where: {
          status: SessionStatus.EXPIRED,
          purpose: IsNull(),
          purposeId: IsNull() as any,
        },
        take: 100,
      });

      for (const session of expiredSessionsNoPurpose) {
        await this.sessionRepository.delete(session.sessionId);
        cleanedCount++;
        this.logger.debug(`🗑️ Deleted expired session (no purpose): ${session.sessionId}`);
      }

      if (expiredSessionsNoPurpose.length > 0) {
        this.logger.log(`🗑️ Deleted ${expiredSessionsNoPurpose.length} expired session(s) without purpose`);
      }

      // 4. Delete old expired sessions with purpose (older than 7 days)
      const expiredThreshold = new Date(now.getTime() - this.EXPIRED_SESSION_RETENTION_MS);
      const oldExpiredSessions = await this.sessionRepository.getRepository().find({
        where: {
          status: SessionStatus.EXPIRED,
          updatedAt: LessThanOrEqual(expiredThreshold),
        },
        take: 100,
      });

      for (const session of oldExpiredSessions) {
        // Don't delete if purpose is still active
        if (session.purposeId) {
          const purpose = await this.sessionPurposeRepository.findById(session.purposeId);
          if (purpose?.status === SessionPurposeStatus.ACTIVE) {
            this.logger.debug(`🛡️ Keeping expired session ${session.sessionId} - purpose is still active`);
            continue;
          }
        }

        await this.sessionRepository.delete(session.sessionId);
        cleanedCount++;
        this.logger.debug(`🗑️ Deleted old expired session: ${session.sessionId}`);
      }

      if (oldExpiredSessions.length > 0) {
        this.logger.log(`🗑️ Deleted ${oldExpiredSessions.length} old expired session(s)`);
      }

      // 5. Log session statistics
      const stats = await this.sessionRepository.getStats();
      const purposeStats = await this.sessionPurposeRepository.getStats();
      
      this.logger.debug(`📊 Session stats: ${stats.totalSessions} total, ${stats.activeSessions} active, ${stats.totalMessages} messages`);
      this.logger.debug(`📊 Purpose stats: ${purposeStats.total} total, ${purposeStats.active} active, ${purposeStats.completed} completed`);

      this.logger.debug(`🧹 Cleanup completed. Processed ${cleanedCount} session(s)`);
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Manual cleanup trigger (for debugging/admin)
   */
  async forceCleanup(): Promise<{
    expired: number;
    inactive: number;
    deleted: number;
  }> {
    this.logger.warn('🧹 Manual cleanup triggered');

    const now = new Date();
    const result = { expired: 0, inactive: 0, deleted: 0 };

    // Get protected session IDs (from active purposes)
    const activePurposes = await this.sessionPurposeRepository.getRepository().find({
      where: { status: SessionPurposeStatus.ACTIVE },
      select: ['id', 'lastSessionId', 'initialSessionId'],
    });

    const protectedSessionIds = new Set<string>(
      activePurposes.flatMap(p => [p.lastSessionId, p.initialSessionId].filter(Boolean) as string[])
    );

    // Expire unvalidated (except protected)
    const unvalidatedThreshold = new Date(now.getTime() - this.UNVALIDATED_SESSION_TIMEOUT_MS);
    const unvalidatedSessions = await this.sessionRepository.findUnvalidatedSessionsOlderThan(unvalidatedThreshold);
    for (const session of unvalidatedSessions) {
      if (!protectedSessionIds.has(session.sessionId)) {
        await this.sessionRepository.expire(session.sessionId);
        result.expired++;
      }
    }

    // Expire inactive (except protected)
    const inactiveThreshold = new Date(now.getTime() - this.INACTIVE_SESSION_TIMEOUT_MS);
    const inactiveSessions = await this.sessionRepository.findInactiveSessionsSince(inactiveThreshold);
    for (const session of inactiveSessions) {
      if (!protectedSessionIds.has(session.sessionId)) {
        await this.sessionRepository.expire(session.sessionId);
        result.inactive++;
      }
    }

    // Delete expired sessions without purpose (immediate)
    const expiredSessionsNoPurpose = await this.sessionRepository.getRepository().find({
      where: {
        status: SessionStatus.EXPIRED,
        purpose: IsNull(),
        purposeId: IsNull() as any,
      },
      take: 100,
    });
    for (const session of expiredSessionsNoPurpose) {
      await this.sessionRepository.delete(session.sessionId);
      result.deleted++;
    }

    // Delete old expired sessions with purpose (older than 7 days)
    const expiredThreshold = new Date(now.getTime() - this.EXPIRED_SESSION_RETENTION_MS);
    const expiredSessions = await this.sessionRepository.getRepository().find({
      where: {
        status: SessionStatus.EXPIRED,
        updatedAt: LessThanOrEqual(expiredThreshold),
      },
      take: 100,
    });
    for (const session of expiredSessions) {
      // Don't delete if purpose is still active
      if (session.purposeId) {
        const purpose = await this.sessionPurposeRepository.findById(session.purposeId);
        if (purpose?.status === SessionPurposeStatus.ACTIVE) {
          continue;
        }
      }
      await this.sessionRepository.delete(session.sessionId);
      result.deleted++;
    }

    this.logger.log(`✅ Manual cleanup completed: ${JSON.stringify(result)}`);
    return result;
  }

  private getAge(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }
}
