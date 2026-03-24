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
    let protectedCount = 0;

    try {
      // Get all active purposes to protect ONLY their last session
      const activePurposes = await this.sessionPurposeRepository.getRepository().find({
        where: { status: SessionPurposeStatus.ACTIVE },
        select: ['id', 'lastSessionId'],
      });

      // ONLY protect the lastSessionId of each active purpose (not initialSessionId)
      const protectedSessionIds = new Set<string>(
        activePurposes.map(p => p.lastSessionId).filter(Boolean) as string[]
      );

      protectedCount = protectedSessionIds.size;
      this.logger.debug(`🛡️ Protecting ${protectedCount} sessions (last session of active purposes)`);

      // 1. Delete expired sessions WITHOUT purpose (IMMEDIATE - highest priority)
      const expiredSessionsNoPurpose = await this.sessionRepository.getRepository().find({
        where: {
          status: SessionStatus.EXPIRED,
          purposeId: IsNull() as any,
        },
        take: 500, // Batch delete
      });

      for (const session of expiredSessionsNoPurpose) {
        await this.sessionRepository.delete(session.sessionId);
        cleanedCount++;
      }

      if (expiredSessionsNoPurpose.length > 0) {
        this.logger.log(`🗑️ DELETED ${expiredSessionsNoPurpose.length} expired session(s) without purpose`);
      }

      // 2. Delete old expired sessions WITH purpose (older than 7 days)
      const expiredThreshold = new Date(now.getTime() - this.EXPIRED_SESSION_RETENTION_MS);
      const oldExpiredSessions = await this.sessionRepository.getRepository().find({
        where: {
          status: SessionStatus.EXPIRED,
          updatedAt: LessThanOrEqual(expiredThreshold),
        },
        take: 500,
      });

      let deletedOldCount = 0;
      for (const session of oldExpiredSessions) {
        // Don't delete if purpose is still active
        if (session.purposeId) {
          const purpose = await this.sessionPurposeRepository.findById(session.purposeId);
          if (purpose?.status === SessionPurposeStatus.ACTIVE) {
            this.logger.debug(`🛡️ Keeping expired session ${session.sessionId} - purpose still active`);
            continue;
          }
        }
        await this.sessionRepository.delete(session.sessionId);
        deletedOldCount++;
      }

      if (deletedOldCount > 0) {
        this.logger.log(`🗑️ DELETED ${deletedOldCount} old expired session(s)`);
        cleanedCount += deletedOldCount;
      }

      // 3. Expire unvalidated sessions older than 5 minutes (except protected last sessions)
      const unvalidatedThreshold = new Date(now.getTime() - this.UNVALIDATED_SESSION_TIMEOUT_MS);
      const unvalidatedSessions = await this.sessionRepository.findUnvalidatedSessionsOlderThan(unvalidatedThreshold);

      let expiredUnvalidatedCount = 0;
      for (const session of unvalidatedSessions) {
        // Skip ONLY if it's the last session of an active purpose
        if (protectedSessionIds.has(session.sessionId)) {
          this.logger.debug(`🛡️ Skipping protected last session: ${session.sessionId}`);
          continue;
        }

        await this.sessionRepository.expire(session.sessionId);
        expiredUnvalidatedCount++;
      }

      if (expiredUnvalidatedCount > 0) {
        this.logger.log(`⏰ EXPIRED ${expiredUnvalidatedCount} unvalidated session(s)`);
        cleanedCount += expiredUnvalidatedCount;
      }

      // 4. Expire inactive sessions (no activity for 24 hours) - EXCEPT protected last sessions
      const inactiveThreshold = new Date(now.getTime() - this.INACTIVE_SESSION_TIMEOUT_MS);
      const inactiveSessions = await this.sessionRepository.findInactiveSessionsSince(inactiveThreshold);

      let expiredInactiveCount = 0;
      for (const session of inactiveSessions) {
        // Skip ONLY if it's the last session of an active purpose
        if (protectedSessionIds.has(session.sessionId)) {
          continue;
        }

        await this.sessionRepository.expire(session.sessionId);
        expiredInactiveCount++;
      }

      if (expiredInactiveCount > 0) {
        this.logger.log(`⏰ EXPIRED ${expiredInactiveCount} inactive session(s) (protected: ${protectedCount})`);
        cleanedCount += expiredInactiveCount;
      }

      // 5. Log session statistics
      const stats = await this.sessionRepository.getStats();
      const purposeStats = await this.sessionPurposeRepository.getStats();

      this.logger.log(`📊 Stats: ${stats.totalSessions} total, ${stats.activeSessions} active, ${stats.expiredSessions || 0} expired, ${stats.totalMessages} messages`);
      this.logger.log(`📊 Purposes: ${purposeStats.total} total, ${purposeStats.active} active, ${purposeStats.completed} completed`);
      this.logger.log(`🧹 Cleanup completed. Processed ${cleanedCount} session(s)`);

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

    // Get ONLY lastSessionId from active purposes (not initialSessionId)
    const activePurposes = await this.sessionPurposeRepository.getRepository().find({
      where: { status: SessionPurposeStatus.ACTIVE },
      select: ['id', 'lastSessionId'],
    });

    const protectedSessionIds = new Set<string>(
      activePurposes.map(p => p.lastSessionId).filter(Boolean) as string[]
    );

    // 1. Delete expired sessions WITHOUT purpose (IMMEDIATE)
    const expiredSessionsNoPurpose = await this.sessionRepository.getRepository().find({
      where: {
        status: SessionStatus.EXPIRED,
        purposeId: IsNull() as any,
      },
      take: 500,
    });
    for (const session of expiredSessionsNoPurpose) {
      await this.sessionRepository.delete(session.sessionId);
      result.deleted++;
    }

    // 2. Delete old expired sessions WITH purpose (older than 7 days)
    const expiredThreshold = new Date(now.getTime() - this.EXPIRED_SESSION_RETENTION_MS);
    const expiredSessions = await this.sessionRepository.getRepository().find({
      where: {
        status: SessionStatus.EXPIRED,
        updatedAt: LessThanOrEqual(expiredThreshold),
      },
      take: 500,
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

    // 3. Expire unvalidated (except protected last sessions)
    const unvalidatedThreshold = new Date(now.getTime() - this.UNVALIDATED_SESSION_TIMEOUT_MS);
    const unvalidatedSessions = await this.sessionRepository.findUnvalidatedSessionsOlderThan(unvalidatedThreshold);
    for (const session of unvalidatedSessions) {
      if (!protectedSessionIds.has(session.sessionId)) {
        await this.sessionRepository.expire(session.sessionId);
        result.expired++;
      }
    }

    // 4. Expire inactive (except protected last sessions)
    const inactiveThreshold = new Date(now.getTime() - this.INACTIVE_SESSION_TIMEOUT_MS);
    const inactiveSessions = await this.sessionRepository.findInactiveSessionsSince(inactiveThreshold);
    for (const session of inactiveSessions) {
      if (!protectedSessionIds.has(session.sessionId)) {
        await this.sessionRepository.expire(session.sessionId);
        result.inactive++;
      }
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
