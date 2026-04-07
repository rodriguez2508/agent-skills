/**
 * Redis Service
 *
 * Provides common Redis operations for caching, sessions, and rate limiting.
 */

import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(@Inject('REDIS_CLIENT') client: Redis) {
    this.client = client;

    this.client.on('connect', () => {
      this.logger.log('✅ Redis connected');
    });

    this.client.on('error', (error) => {
      this.logger.error(`❌ Redis error: ${error.message}`);
    });

    this.client.on('close', () => {
      this.logger.warn('⚠️ Redis connection closed');
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('📦 Redis connection closed');
  }

  // ========== Cache Operations ==========

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;

    try {
      return JSON.parse(data) as T;
    } catch {
      return data as T;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);

    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  // ========== Session Operations ==========

  async getSession(sessionId: string): Promise<any | null> {
    return this.get(`session:${sessionId}`);
  }

  async setSession(
    sessionId: string,
    data: any,
    ttlSeconds = 86400,
  ): Promise<void> {
    await this.set(`session:${sessionId}`, data, ttlSeconds);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  // ========== Cache with TTL ==========

  async cacheGet<T>(key: string): Promise<T | null> {
    return this.get(`cache:${key}`);
  }

  async cacheSet(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    await this.set(`cache:${key}`, value, ttlSeconds);
  }

  async cacheDelete(key: string): Promise<void> {
    await this.del(`cache:${key}`);
  }

  async cacheClear(pattern = 'cache:*'): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  // ========== Rate Limiting ==========

  async incrementRateLimit(
    key: string,
    windowSeconds = 60,
  ): Promise<{ count: number; remaining: number; reset: number }> {
    const rateKey = `ratelimit:${key}`;
    const multi = this.client.multi();

    multi.incr(rateKey);
    multi.expire(rateKey, windowSeconds);

    const results = await multi.exec();
    const count = (results?.[0]?.[1] as number) || 1;

    const ttl = await this.client.ttl(rateKey);

    return {
      count,
      remaining: Math.max(0, 100 - count), // Assuming 100 requests limit
      reset: Date.now() + ttl * 1000,
    };
  }

  async resetRateLimit(key: string): Promise<void> {
    await this.del(`ratelimit:${key}`);
  }

  // ========== Pub/Sub ==========

  async publish(channel: string, message: any): Promise<number> {
    const serialized =
      typeof message === 'string' ? message : JSON.stringify(message);
    return this.client.publish(channel, serialized);
  }

  async subscribe(
    channel: string,
    callback: (message: string) => void,
  ): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.subscribe(channel);
    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        callback(message);
      }
    });
  }

  // ========== Health Check ==========

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency?: number;
  }> {
    const start = Date.now();

    try {
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
      };
    }
  }

  // ========== Utility Methods ==========

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async flushDb(): Promise<void> {
    await this.client.flushdb();
    this.logger.warn('🧹 Redis database flushed');
  }
}
