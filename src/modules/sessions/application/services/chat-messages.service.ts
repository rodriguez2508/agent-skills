/**
 * Chat Messages Service
 *
 * Stores temporary chat messages in Redis.
 * Messages are consumed when a plan is created (migrated to contexts as memory).
 * Daily cron job cleans up residual messages at 12 AM.
 */

import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@infrastructure/database/redis/redis.service';

export interface ChatMessageData {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: any;
}

@Injectable()
export class ChatMessagesService {
  private readonly logger = new Logger(ChatMessagesService.name);
  private static readonly TTL_SECONDS = 86400; // 24 hours
  private static readonly KEY_PREFIX = 'chat';

  constructor(private readonly redisService: RedisService) {}

  private getKey(sessionId: string): string {
    return `${ChatMessagesService.KEY_PREFIX}:${sessionId}:messages`;
  }

  /**
   * Save a message to Redis
   */
  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: any,
  ): Promise<void> {
    const key = this.getKey(sessionId);
    const message: ChatMessageData = {
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    };

    // Use Redis list - LPUSH to prepend (newest first)
    const client = this.redisService['client'];
    await client.lpush(key, JSON.stringify(message));
    await client.expire(key, ChatMessagesService.TTL_SECONDS);

    this.logger.debug(`💬 Message saved to Redis: ${sessionId} - ${role}`);
  }

  /**
   * Get all messages for a session (ordered by timestamp ascending)
   */
  async getMessages(sessionId: string): Promise<ChatMessageData[]> {
    const key = this.getKey(sessionId);
    const client = this.redisService['client'];
    const raw = await client.lrange(key, 0, -1);

    // Reverse because we LPUSH (newest first)
    return raw
      .map((r) => JSON.parse(r) as ChatMessageData)
      .reverse();
  }

  /**
   * Get message count for a session
   */
  async getMessageCount(sessionId: string): Promise<number> {
    const key = this.getKey(sessionId);
    const client = this.redisService['client'];
    return client.llen(key);
  }

  /**
   * Delete all messages for a session
   */
  async deleteMessages(sessionId: string): Promise<void> {
    const key = this.getKey(sessionId);
    await this.redisService.del(key);
    this.logger.debug(`🗑️ Messages deleted from Redis: ${sessionId}`);
  }

  /**
   * Consume messages: read all, then delete.
   * Used when creating a plan to migrate messages to context.
   */
  async consumeMessages(sessionId: string): Promise<ChatMessageData[]> {
    const messages = await this.getMessages(sessionId);
    if (messages.length > 0) {
      await this.deleteMessages(sessionId);
      this.logger.log(
        `📥 Consumed ${messages.length} messages from Redis: ${sessionId}`,
      );
    }
    return messages;
  }

  /**
   * Clean up residual messages older than TTL.
   * Called by cron job at 12 AM.
   */
  async cleanup(): Promise<{ cleaned: number; errors: number }> {
    const client = this.redisService['client'];
    const pattern = `${ChatMessagesService.KEY_PREFIX}:*:messages`;
    const keys = await client.keys(pattern);

    let cleaned = 0;
    let errors = 0;

    for (const key of keys) {
      try {
        const ttl = await client.ttl(key);
        // If TTL is -1 (no expiry) or -2 (key doesn't exist), delete it
        if (ttl < 0) {
          await client.del(key);
          cleaned++;
        }
      } catch {
        errors++;
      }
    }

    this.logger.log(
      `🧹 Chat messages cleanup: ${cleaned} cleaned, ${errors} errors, ${keys.length} total keys`,
    );
    return { cleaned, errors };
  }

  /**
   * Get all active session IDs with chat messages.
   * Used by frontend to show sessions.
   */
  async getActiveSessionIds(): Promise<string[]> {
    const client = this.redisService['client'];
    const keys = await client.keys(`${ChatMessagesService.KEY_PREFIX}:*:messages`);
    return keys.map((k) => {
      // Extract sessionId from key: chat:{sessionId}:messages
      const parts = k.split(':');
      return parts[1];
    });
  }
}
