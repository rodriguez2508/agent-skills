/**
 * Auth Service
 *
 * Handles user authentication and session management.
 * Users are grouped by IP address.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { SessionRepository } from '@modules/sessions/infrastructure/persistence/session.repository';
import { SessionCleanupService } from '@modules/sessions/infrastructure/services/session-cleanup.service';
import { SessionStatus } from '@modules/sessions/domain/entities/session.entity';
import { PasswordHashService } from '../../infrastructure/services/password-hash.service';
import { TokenService } from '../../infrastructure/services/token.service';
import { EmailService } from '../../infrastructure/services/email.service';

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
  emailVerified: boolean;
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

export interface RegisterWithPasswordDto {
  email: string;
  password: string;
  name?: string;
  avatar?: string;
  ipAddress: string;
  sessionId: string;
}

export interface LoginWithPasswordDto {
  email: string;
  password: string;
  ipAddress: string;
  sessionId: string;
}

export interface RequestPasswordResetDto {
  email: string;
  frontendUrl: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly frontendBaseUrl: string;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly sessionCleanupService: SessionCleanupService,
    private readonly passwordHashService: PasswordHashService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.frontendBaseUrl =
      this.configService.get<string>('FRONTEND_BASE_URL') ||
      'http://localhost:3000';
  }

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
   * Register user with email and password
   */
  async registerWithPassword(data: RegisterWithPasswordDto): Promise<AuthResult> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(data.email);

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.passwordHashService.hashPassword(data.password);

    // Generate email verification token
    const { token: verificationToken, hashedToken, expires } =
      this.tokenService.generateEmailVerificationToken();

    // Create user
    const { user } = await this.userRepository.findByIpOrCreate({
      ipAddress: data.ipAddress,
      email: data.email,
      name: data.name,
      avatar: data.avatar,
      password: hashedPassword,
    });

    // Save verification token
    await this.userRepository.setEmailVerificationToken(user.id, hashedToken, expires);

    // Send verification email
    const verificationUrl = `${this.frontendBaseUrl}/auth/verify-email?token=${verificationToken}`;
    await this.emailService.sendVerificationEmail(
      data.email,
      verificationUrl,
      data.name,
    );

    // Create session
    const session = await this.sessionRepository.create({
      sessionId: data.sessionId,
      userId: user.id,
      title: data.name ? `Session with ${data.name}` : undefined,
      metadata: {
        ipAddress: data.ipAddress,
      },
    });

    this.logger.log(`🔐 User registered with email: ${user.id} (${data.email})`);

    return {
      user: this.mapUserToDto(user),
      session: this.mapSessionToDto(session),
      isNewUser: true,
    };
  }

  /**
   * Login with email and password
   */
  async loginWithPassword(data: LoginWithPasswordDto): Promise<AuthResult> {
    const user = await this.userRepository.findByEmailWithPassword(data.email);

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.active) {
      throw new BadRequestException('User account is not active');
    }

    // Verify password
    const isPasswordValid = await this.passwordHashService.comparePassword(
      data.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update user's IP address
    await this.userRepository.updateIpAddress(user.id, data.ipAddress);

    // Create session
    const session = await this.sessionRepository.create({
      sessionId: data.sessionId,
      userId: user.id,
      metadata: {
        ipAddress: data.ipAddress,
      },
    });

    this.logger.log(`🔐 User logged in with password: ${user.id} (${data.email})`);

    return {
      user: this.mapUserToDto(user),
      session: this.mapSessionToDto(session),
      isNewUser: false,
    };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const hashedToken = this.tokenService.hashToken(token);
    const user = await this.userRepository.findByEmailVerificationToken(hashedToken);

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Mark email as verified
    await this.userRepository.markEmailAsVerified(user.id);

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email, user.name);

    this.logger.log(`✅ Email verified for user: ${user.id} (${user.email})`);

    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(data: RequestPasswordResetDto): Promise<{
    success: boolean;
    message: string;
  }> {
    const user = await this.userRepository.findByEmail(data.email);

    // Always return success to prevent email enumeration
    if (!user) {
      return {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    // Generate reset token
    const { token: resetToken, hashedToken, expires } =
      this.tokenService.generatePasswordResetToken();

    // Save reset token
    await this.userRepository.setPasswordResetToken(user.id, hashedToken, expires);

    // Send reset email
    const resetUrl = `${data.frontendUrl}/auth/reset-password?token=${resetToken}`;
    await this.emailService.sendPasswordResetEmail(
      data.email,
      resetUrl,
      user.name,
    );

    this.logger.log(`🔑 Password reset requested for user: ${user.id} (${data.email})`);

    return {
      success: true,
      message: 'If the email exists, a password reset link has been sent',
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: ResetPasswordDto): Promise<{
    success: boolean;
    message: string;
  }> {
    const hashedToken = this.tokenService.hashToken(data.token);
    const user = await this.userRepository.findByResetPasswordToken(hashedToken);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await this.passwordHashService.hashPassword(data.newPassword);

    // Update password and clear reset token
    await this.userRepository.updatePassword(user.id, hashedPassword);
    await this.userRepository.clearPasswordResetToken(user.id);

    this.logger.log(`🔐 Password reset for user: ${user.id} (${user.email})`);

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  /**
   * Change password (for authenticated users)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findByEmailWithPassword(
      await this.userRepository.findById(userId).then((u) => u?.email) || '',
    );

    if (!user || !user.password) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = await this.passwordHashService.comparePassword(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash and update new password
    const hashedPassword = await this.passwordHashService.hashPassword(newPassword);
    await this.userRepository.updatePassword(userId, hashedPassword);

    this.logger.log(`🔐 Password changed for user: ${userId}`);

    return {
      success: true,
      message: 'Password changed successfully',
    };
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
      emailVerified: user.emailVerified,
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
