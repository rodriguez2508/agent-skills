/**
 * Redis Refresh Token Repository
 *
 * Stores refresh token metadata in Redis for validation and rotation.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';
import { RefreshTokenMetadata } from '../../domain/entities/auth.entity';

@Injectable()
export class RedisRefreshTokenRepository implements RefreshTokenRepository {
  private readonly logger = new Logger(RedisRefreshTokenRepository.name);
  private static readonly PREFIX = 'refresh:';

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async storeRefreshToken(
    userId: string,
    metadata: RefreshTokenMetadata,
    ttlSeconds: number,
  ): Promise<void> {
    const key = `${RedisRefreshTokenRepository.PREFIX}${userId}`;
    await this.redis.set(
      key,
      JSON.stringify(metadata),
      'EX',
      ttlSeconds,
    );
    this.logger.debug(`Refresh token stored for user ${userId}`);
  }

  async getRefreshToken(userId: string): Promise<RefreshTokenMetadata | null> {
    const key = `${RedisRefreshTokenRepository.PREFIX}${userId}`;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RefreshTokenMetadata;
    } catch {
      this.logger.warn(`Invalid refresh token metadata for user ${userId}`);
      return null;
    }
  }

  async deleteRefreshToken(userId: string): Promise<void> {
    const key = `${RedisRefreshTokenRepository.PREFIX}${userId}`;
    await this.redis.del(key);
    this.logger.debug(`Refresh token deleted for user ${userId}`);
  }
}
