/**
 * Auth Service
 *
 * Handles user authentication and session management.
 * Users are grouped by IP address.
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { SessionRepository } from '@modules/sessions/infrastructure/persistence/session.repository';
import { SessionCleanupService } from '@modules/sessions/infrastructure/services/session-cleanup.service';
import { SessionStatus } from '@modules/sessions/domain/entities/session.entity';

export interface AuthResult {
  user: UserDto;
  session: SessionDto;
  isNewUser: boolean;
}

export interface UserDto {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  active: boolean;
  preferences?: any;
  totalSessions: number;
  totalSearches: number;
  lastIpAddress?: string;
  createdAt: Date;
}

export interface SessionDto {
  id: string;
  sessionId: string;
  status: SessionStatus;
  title?: string;
  messageCount: number;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly sessionCleanupService: SessionCleanupService,
  ) {}

  /**
   * Register or login user by IP address
   * If user exists for this IP, return existing user
   * If not, create new user grouped by IP
   */
  async registerOrLogin(data: {
    ipAddress: string;
    email?: string;
    name?: string;
    avatar?: string;
    sessionId: string;
  }): Promise<AuthResult> {
    // Find or create user by IP
    const { user, isNew } = await this.userRepository.findByIpOrCreate({
      ipAddress: data.ipAddress,
      email: data.email,
      name: data.name,
      avatar: data.avatar,
    });

    // Create new session for this user
    const session = await this.sessionRepository.create({
      sessionId: data.sessionId,
      userId: user.id,
      title: data.name ? `Session with ${data.name}` : undefined,
      metadata: {
        ipAddress: data.ipAddress,
      },
    });

    this.logger.log(
      `🔐 User ${isNew ? 'registered' : 'logged in'}: ${user.id} from IP ${data.ipAddress}`,
    );

    return {
      user: this.mapUserToDto(user),
      session: this.mapSessionToDto(session),
      isNewUser: isNew,
    };
  }

  /**
   * Login existing user by email
   */
  async loginByEmail(data: {
    email: string;
    ipAddress: string;
    sessionId: string;
  }): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(data.email);

    if (!user) {
      throw new BadRequestException('User not found with this email');
    }

    if (!user.active) {
      throw new BadRequestException('User account is not active');
    }

    // Update user's IP address
    await this.userRepository.updateIpAddress(user.id, data.ipAddress);

    // Create new session
    const session = await this.sessionRepository.create({
      sessionId: data.sessionId,
      userId: user.id,
      metadata: {
        ipAddress: data.ipAddress,
      },
    });

    this.logger.log(`🔐 User logged in by email: ${user.id} (${data.email})`);

    return {
      user: this.mapUserToDto(user),
      session: this.mapSessionToDto(session),
      isNewUser: false,
    };
  }

  /**
   * Logout - close session
   */
  async logout(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findBySessionId(sessionId);

    if (session) {
      await this.sessionRepository.updateStatus(sessionId, SessionStatus.ENDED);
      this.logger.log(`🔓 User logged out: ${session.id}`);
    }
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<SessionDto[]> {
    const sessions = await this.sessionRepository.findByUserId(userId);
    return sessions.map((s) => this.mapSessionToDto(s));
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserDto | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) return null;
    return this.mapUserToDto(user);
  }

  /**
   * Get user by session ID
   */
  async getUserBySessionId(sessionId: string): Promise<UserDto | null> {
    const session = await this.sessionRepository.findBySessionId(sessionId);
    if (!session || !session.userId) return null;

    const user = await this.userRepository.findById(session.userId);
    if (!user) return null;

    return this.mapUserToDto(user);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: any,
  ): Promise<UserDto> {
    const user = await this.userRepository.updatePreferences(userId, preferences);
    return this.mapUserToDto(user);
  }

  /**
   * Get user statistics
   */
  async getStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    usersByIp: number;
  }> {
    return this.userRepository.getStats();
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalMessages: number;
  }> {
    return this.sessionRepository.getStats();
  }

  /**
   * Validate a session with a purpose
   */
  async validateSession(sessionId: string, purpose: string): Promise<any> {
    const session = await this.sessionRepository.updatePurpose(sessionId, purpose);
    this.logger.log(`✅ Session validated: ${sessionId} - Purpose: ${purpose}`);
    return session;
  }

  /**
   * Invalidate a session
   */
  async invalidateSession(sessionId: string, reason?: string): Promise<any> {
    const session = await this.sessionRepository.invalidate(sessionId, reason);
    this.logger.warn(`🚫 Session invalidated: ${sessionId}${reason ? ` - ${reason}` : ''}`);
    return session;
  }

  /**
   * Force session cleanup
   */
  async forceSessionCleanup(): Promise<{
    expired: number;
    inactive: number;
    deleted: number;
  }> {
    return this.sessionCleanupService.forceCleanup();
  }

  private mapUserToDto(user: any): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      active: user.active,
      preferences: user.preferences,
      totalSessions: user.totalSessions,
      totalSearches: user.totalSearches,
      lastIpAddress: user.lastIpAddress,
      createdAt: user.createdAt,
    };
  }

  private mapSessionToDto(session: any): SessionDto {
    return {
      id: session.id,
      sessionId: session.sessionId,
      status: session.status,
      title: session.title,
      messageCount: session.messageCount,
      createdAt: session.createdAt,
    };
  }
}
