/**
 * User Repository (TypeORM Implementation)
 *
 * Handles user persistence with PostgreSQL.
 * Users are grouped by IP address for tracking.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import {
  IUserRepository,
  CreateUserDto,
  FindUserByIpResult,
  UserStats,
} from '../../domain/ports/user-repository.port';

@Injectable()
export class UserRepository implements IUserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  /**
   * Get TypeORM repository for direct operations
   */
  getRepository(): Repository<User> {
    return this.repository;
  }

  /**
   * Find or create user by IP address
   * Users are grouped by IP - same IP = same user
   * Uses transaction with retry to prevent race conditions
   */
  async findByIpOrCreate(data: {
    ipAddress: string;
    email?: string;
    name?: string;
    avatar?: string;
    password?: string;
  }): Promise<FindUserByIpResult> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Try to find existing user by IP
        const user = await this.repository.findOne({
          where: { lastIpAddress: data.ipAddress },
        });

        if (user) {
          this.logger.debug(`👤 User found by IP: ${user.id} (${data.ipAddress})`);
          return { user, isNew: false };
        }

        // Create new user for this IP with unique email
        const newUser = this.repository.create({
          email: data.email || `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@anonymous.local`,
          name: data.name,
          avatar: data.avatar,
          password: data.password,
          lastIpAddress: data.ipAddress,
          ipAddressHistory: [data.ipAddress],
          active: true,
          emailVerified: !!data.email, // If email is provided, mark as verified
          preferences: {},
          totalSessions: 0,
          totalSearches: 0,
        });

        const savedUser = await this.repository.save(newUser);
        this.logger.debug(`✨ New user created for IP ${data.ipAddress}: ${savedUser.id}`);

        return { user: savedUser, isNew: true };
      } catch (error) {
        lastError = error;

        // Check if it's a unique constraint violation (race condition)
        if (error.code === '23505' || error.message.includes('duplicate key')) {
          this.logger.debug(`⚠️ Race condition detected (attempt ${attempt}/${maxRetries}), retrying...`);

          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(100, attempt)));
          continue;
        }

        // Re-throw other errors
        throw error;
      }
    }

    // If all retries failed, find any user with this IP (should exist now)
    const user = await this.repository.findOne({
      where: { lastIpAddress: data.ipAddress },
    });

    if (user) {
      this.logger.debug(`👤 User found after retries: ${user.id} (${data.ipAddress})`);
      return { user, isNew: false };
    }

    // Last resort - throw error
    throw new Error(`Failed to create/find user for IP ${data.ipAddress} after ${maxRetries} retries: ${lastError?.message}`);
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['sessions'],
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
      select: ['id', 'email', 'name', 'avatar', 'active', 'emailVerified', 'password', 'preferences', 'totalSessions', 'totalSearches', 'lastIpAddress', 'ipAddressHistory', 'createdAt', 'updatedAt'],
    });
  }

  /**
   * Find user by email with password (for authentication)
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
      select: ['id', 'email', 'name', 'avatar', 'active', 'emailVerified', 'password', 'preferences', 'totalSessions', 'totalSearches', 'lastIpAddress', 'ipAddressHistory', 'createdAt', 'updatedAt', 'emailVerificationToken', 'emailVerificationTokenExpires', 'resetPasswordToken', 'resetPasswordTokenExpires'],
    });
  }

  /**
   * Find user by email verification token
   */
  async findByEmailVerificationToken(token: string): Promise<User | null> {
    return this.repository.findOne({
      where: {
        emailVerificationToken: token,
        emailVerificationTokenExpires: MoreThanOrEqual(new Date()),
      },
    });
  }

  /**
   * Find user by password reset token
   */
  async findByResetPasswordToken(token: string): Promise<User | null> {
    return this.repository.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordTokenExpires: MoreThanOrEqual(new Date()),
      },
    });
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, hashedPassword: string): Promise<User> {
    await this.repository.update(userId, {
      password: hashedPassword,
    });
    const user = await this.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    return user;
  }

  /**
   * Set email verification token
   */
  async setEmailVerificationToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<void> {
    await this.repository.update(userId, {
      emailVerificationToken: token,
      emailVerificationTokenExpires: expires,
    });
  }

  /**
   * Clear email verification token (after verification)
   */
  async clearEmailVerificationToken(userId: string): Promise<void> {
    await this.repository.update(userId, {
      emailVerificationToken: undefined,
      emailVerificationTokenExpires: undefined,
    });
  }

  /**
   * Mark email as verified
   */
  async markEmailAsVerified(userId: string): Promise<void> {
    await this.repository.update(userId, {
      emailVerified: true,
      emailVerificationToken: undefined,
      emailVerificationTokenExpires: undefined,
    });
  }

  /**
   * Set password reset token
   */
  async setPasswordResetToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<void> {
    await this.repository.update(userId, {
      resetPasswordToken: token,
      resetPasswordTokenExpires: expires,
    });
  }

  /**
   * Clear password reset token
   */
  async clearPasswordResetToken(userId: string): Promise<void> {
    await this.repository.update(userId, {
      resetPasswordToken: undefined,
      resetPasswordTokenExpires: undefined,
    });
  }

  /**
   * Find users by IP addresses (bulk)
   */
  async findByIpAddresses(ipAddresses: string[]): Promise<User[]> {
    return this.repository.find({
      where: { lastIpAddress: In(ipAddresses) },
    });
  }

  /**
   * Update user's IP address (track IP changes)
   */
  async updateIpAddress(userId: string, ipAddress: string): Promise<User> {
    const user = await this.findById(userId);

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Update IP history
    const history = user.ipAddressHistory || [];
    if (!history.includes(ipAddress)) {
      history.push(ipAddress);
    }

    user.lastIpAddress = ipAddress;
    user.ipAddressHistory = history;

    const updated = await this.repository.save(user);
    this.logger.debug(`📍 IP address updated for user ${userId}: ${ipAddress}`);

    return updated;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: User['preferences'],
  ): Promise<User> {
    const user = await this.findById(userId);

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    user.preferences = { ...user.preferences, ...preferences };
    const updated = await this.repository.save(user);

    this.logger.debug(`⚙️ Preferences updated for user ${userId}`);
    return updated;
  }

  /**
   * Increment session counter
   */
  async incrementSessionCount(userId: string): Promise<User> {
    await this.repository.increment({ id: userId }, 'totalSessions', 1);
    const user = await this.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    return user;
  }

  /**
   * Increment search counter
   */
  async incrementSearchCount(userId: string): Promise<User> {
    await this.repository.increment({ id: userId }, 'totalSearches', 1);
    const user = await this.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    return user;
  }

  /**
   * Get all users (for admin/analytics)
   */
  async findAll(limit = 100): Promise<User[]> {
    return this.repository.find({
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get active users
   */
  async findActive(limit = 100): Promise<User[]> {
    return this.repository.find({
      where: { active: true },
      take: limit,
      order: { lastIpAddress: 'ASC' },
    });
  }

  /**
   * Get user statistics
   */
  async getStats(): Promise<UserStats> {
    const [totalUsers, activeUsers] = await Promise.all([
      this.repository.count(),
      this.repository.count({ where: { active: true } }),
    ]);

    // Count unique IPs
    const users = await this.repository.find({
      select: ['lastIpAddress'],
      where: { active: true },
    });
    const uniqueIps = new Set(users.map((u) => u.lastIpAddress).filter(Boolean));

    return {
      totalUsers,
      activeUsers,
      usersByIp: uniqueIps.size,
    };
  }

  /**
   * Delete a user
   */
  async delete(userId: string): Promise<void> {
    const user = await this.findById(userId);

    if (user) {
      await this.repository.remove(user);
      this.logger.debug(`🗑️ User deleted: ${user.id}`);
    }
  }
}
