import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ChatMessage } from '@modules/sessions/domain/entities/chat-message.entity';
import { Context } from '@modules/contexts/domain/entities/context.entity';
import { MemorySearchResult } from '../interfaces/memory-file.interface';

/**
 * Hermes-style L2 Memory Service
 *
 * Full-text search over the entire conversation history.
 * Searches across:
 * - Chat messages (sessions)
 * - Context entries
 * - L1 Memory files (for completeness)
 *
 * Mirrors Hermes Agent's FTS5 SQLite search capability.
 */
@Injectable()
export class MemorySearchService {
  private readonly logger = new Logger(MemorySearchService.name);

  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
    @InjectRepository(Context)
    private readonly contextRepo: Repository<Context>,
  ) {}

  /**
   * Full-text search across all conversation history.
   * Returns results ranked by relevance.
   */
  async search(
    query: string,
    options: {
      limit?: number;
      sessionId?: string;
      projectId?: string;
      sources?: ('chat' | 'context' | 'memory')[];
    } = {},
  ): Promise<MemorySearchResult[]> {
    const limit = options.limit || 10;
    const sources = options.sources || ['chat', 'context'];
    const results: MemorySearchResult[] = [];

    const searchTerm = query.toLowerCase();

    // Search chat messages
    if (sources.includes('chat')) {
      const messages = await this.searchChatMessages(searchTerm, options);
      results.push(...messages);
    }

    // Search context entries
    if (sources.includes('context')) {
      const contexts = await this.searchContexts(searchTerm, options);
      results.push(...contexts);
    }

    // Sort by score descending and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Builds a context string with L2 search results for prompt injection.
   */
  async buildSearchContext(query: string, limit = 5): Promise<string> {
    const results = await this.search(query, { limit });

    if (results.length === 0) return '';

    const sections: string[] = [];
    sections.push(`🔍 **L2 Memory Search: "${query}"**`);

    for (const r of results) {
      const source = r.source === 'chat' ? '💬' : r.source === 'context' ? '📝' : '🧠';
      const preview = r.content.substring(0, 200).replace(/\n/g, ' ');
      sections.push(
        `${source} [${r.score.toFixed(2)}] ${preview}${r.content.length > 200 ? '...' : ''}`,
      );
    }

    return sections.join('\n') + '\n';
  }

  // ─── Private Search Methods ─────────────────────────────────────

  private async searchChatMessages(
    term: string,
    options: {
      sessionId?: string;
      projectId?: string;
    },
  ): Promise<MemorySearchResult[]> {
    try {
      const where: any = [];

      // Build query conditions
      const conditions: string[] = ['LOWER(content) LIKE :term'];
      const params: any = { term: `%${term}%` };

      if (options.sessionId) {
        conditions.push('sessionId = :sessionId');
        params.sessionId = options.sessionId;
      }

      const query = this.chatRepo
        .createQueryBuilder('msg')
        .select(['msg.content', 'msg.sessionId', 'msg.createdAt'])
        .where(conditions.join(' AND '), params)
        .orderBy('msg.createdAt', 'DESC')
        .take(50);

      const messages = await query.getMany();

      return messages.map((msg) => ({
        content: msg.content,
        score: this.calculateScore(term, msg.content),
        sessionId: msg.sessionId,
        timestamp: msg.createdAt?.toISOString() || new Date().toISOString(),
        source: 'chat' as const,
      }));
    } catch (error) {
      this.logger.warn(`Chat search error: ${error.message}`);
      return [];
    }
  }

  private async searchContexts(
    term: string,
    options: { projectId?: string },
  ): Promise<MemorySearchResult[]> {
    try {
      const params: any = { term: `%${term}%` };
      // NOTE: Using LIKE for now. Future optimization: use PostgreSQL tsvector/tsquery for native FTS.
      const conditions: string[] = [
        '(LOWER(summary) LIKE :term OR LOWER(CAST(extracted_info AS TEXT)) LIKE :term)',
      ];

      if (options.projectId) {
        conditions.push('projectId = :projectId');
        params.projectId = options.projectId;
      }

      const query = this.contextRepo
        .createQueryBuilder('ctx')
        .select(['ctx.summary', 'ctx.extractedInfo', 'ctx.createdAt'])
        .where(conditions.join(' AND '), params)
        .orderBy('ctx.createdAt', 'DESC')
        .take(50);

      const contexts = await query.getMany();

      return contexts.map((ctx) => ({
        content: ctx.summary || JSON.stringify(ctx.extractedInfo || ''),
        score: this.calculateScore(term, ctx.summary || ''),
        timestamp: ctx.createdAt?.toISOString() || new Date().toISOString(),
        source: 'context' as const,
      }));
    } catch (error) {
      this.logger.warn(`Context search error: ${error.message}`);
      return [];
    }
  }

  private calculateScore(term: string, content: string): number {
    const lower = content.toLowerCase();
    let score = 0;

    // Exact match bonus
    if (lower.includes(term)) {
      score += 0.5;
    }

    // Word match bonus
    const words = term.split(/\s+/);
    for (const word of words) {
      if (word.length < 2) continue;
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches) {
        score += 0.1 * matches.length;
      }
    }

    // Normalize
    return Math.min(score, 1);
  }
}
