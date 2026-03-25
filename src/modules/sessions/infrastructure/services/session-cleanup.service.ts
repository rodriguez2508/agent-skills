/**
 * Session Cleanup Service
 *
 * Periodically cleans up expired and orphaned sessions.
 * Runs every 5 minutes by default using @nestjs/schedule.
 *
 * Cleanup rules:
 * - Unvalidated sessions older than 5 minutes → EXPIRED
 * - Inactive sessions (no activity for 24 hours) → EXPIRED
 * - Expired sessions → DELETED immediately
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionRepository } from '@modules/sessions/infrastructure/persistence/session.repository';
import { SessionStatus } from '@modules/sessions/domain/entities/session.entity';
import { LessThanOrEqual, IsNull } from 'typeorm';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  // Configuration
  private readonly UNVALIDATED_SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly INACTIVE_SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly sessionRepository: SessionRepository,
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
      // 1. Delete expired sessions (IMMEDIATE)
      const expiredSessions = await this.sessionRepository.getRepository().find({
        where: {
          status: SessionStatus.EXPIRED,
        },
        take: 500,
      });

      for (const session of expiredSessions) {
        await this.sessionRepository.delete(session.sessionId);
        cleanedCount++;
      }

      if (expiredSessions.length > 0) {
        this.logger.log(`🗑️ DELETED ${expiredSessions.length} expired session(s)`);
      }

      // 2. Expire unvalidated sessions older than 5 minutes
      const unvalidatedThreshold = new Date(now.getTime() - this.UNVALIDATED_SESSION_TIMEOUT_MS);
      const unvalidatedSessions = await this.sessionRepository.findUnvalidatedSessionsOlderThan(unvalidatedThreshold);

      for (const session of unvalidatedSessions) {
        await this.sessionRepository.expire(session.sessionId);
        cleanedCount++;
      }

      if (unvalidatedSessions.length > 0) {
        this.logger.log(`⏰ EXPIRED ${unvalidatedSessions.length} unvalidated session(s)`);
      }

      // 3. Expire inactive sessions (no activity for 24 hours)
      const inactiveThreshold = new Date(now.getTime() - this.INACTIVE_SESSION_TIMEOUT_MS);
      const inactiveSessions = await this.sessionRepository.findInactiveSessionsSince(inactiveThreshold);

      for (const session of inactiveSessions) {
        await this.sessionRepository.expire(session.sessionId);
        cleanedCount++;
      }

      if (inactiveSessions.length > 0) {
        this.logger.log(`⏰ EXPIRED ${inactiveSessions.length} inactive session(s)`);
      }

      // 4. Log session statistics
      const stats = await this.sessionRepository.getStats();

      this.logger.log(`📊 Stats: ${stats.totalSessions} total, ${stats.activeSessions} active, ${stats.expiredSessions || 0} expired, ${stats.totalMessages} messages`);
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

    // 1. Delete expired sessions (IMMEDIATE)
    const expiredSessions = await this.sessionRepository.getRepository().find({
      where: {
        status: SessionStatus.EXPIRED,
      },
      take: 500,
    });
    for (const session of expiredSessions) {
      await this.sessionRepository.delete(session.sessionId);
      result.deleted++;
    }

    // 2. Expire unvalidated
    const unvalidatedThreshold = new Date(now.getTime() - this.UNVALIDATED_SESSION_TIMEOUT_MS);
    const unvalidatedSessions = await this.sessionRepository.findUnvalidatedSessionsOlderThan(unvalidatedThreshold);
    for (const session of unvalidatedSessions) {
      await this.sessionRepository.expire(session.sessionId);
      result.expired++;
    }

    // 3. Expire inactive
    const inactiveThreshold = new Date(now.getTime() - this.INACTIVE_SESSION_TIMEOUT_MS);
    const inactiveSessions = await this.sessionRepository.findInactiveSessionsSince(inactiveThreshold);
    for (const session of inactiveSessions) {
      await this.sessionRepository.expire(session.sessionId);
      result.inactive++;
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
