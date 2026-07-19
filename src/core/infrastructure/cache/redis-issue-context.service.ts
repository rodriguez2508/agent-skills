import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@infrastructure/database/redis/redis.service';

export interface IssueMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  agentId?: string;
}

export interface IssueContextData {
  issueId: string;
  projectId: string;
  projectName: string;
  title: string;
  initialMessage: string;
  createdAt: string;
  lastActivityAt: string;
  messages: IssueMessage[];
  keyDecisions: string[];
  filesModified: string[];
  summary?: string;
}

@Injectable()
export class RedisIssueContextService {
  private readonly logger = new Logger(RedisIssueContextService.name);
  private readonly CONTEXT_TTL = 30 * 24 * 60 * 60;
  private readonly MAX_MESSAGES = 50;
  private readonly CONTEXT_PREFIX = 'issue:context:';
  private readonly INDEX_PREFIX = 'issue:index:';

  constructor(private readonly redisService: RedisService) {}

  async saveContext(issueId: string, context: IssueContextData): Promise<void> {
    try {
      const messages = context.messages.slice(-this.MAX_MESSAGES);
      const contextToSave = {
        ...context,
        messages,
      };

      const key = `${this.CONTEXT_PREFIX}${issueId}`;
      await this.redisService.set(
        key,
        JSON.stringify(contextToSave),
        this.CONTEXT_TTL,
      );

      await this.addToProjectIndex(context.projectId, issueId);

      this.logger.debug(`💾 Context saved for issue: ${issueId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to save context for issue ${issueId}: ${error}`,
      );
    }
  }

  async getContext(issueId: string): Promise<IssueContextData | null> {
    try {
      const key = `${this.CONTEXT_PREFIX}${issueId}`;
      const data = await this.redisService.get<string>(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(
        `❌ Failed to get context for issue ${issueId}: ${error}`,
      );
      return null;
    }
  }

  async addMessage(issueId: string, message: IssueMessage): Promise<void> {
    const context = await this.getContext(issueId);
    if (!context) {
      this.logger.warn(`⚠️ No context found for issue ${issueId}`);
      return;
    }

    context.messages.push(message);
    context.lastActivityAt = new Date().toISOString();

    const messages = context.messages.slice(-this.MAX_MESSAGES);
    context.messages = messages;

    await this.saveContext(issueId, context);
  }

  async updateSummary(issueId: string, summary: string): Promise<void> {
    const context = await this.getContext(issueId);
    if (!context) return;

    context.summary = summary;
    context.lastActivityAt = new Date().toISOString();

    await this.saveContext(issueId, context);
  }

  async deleteContext(issueId: string, projectId: string): Promise<void> {
    try {
      await this.redisService.del(`${this.CONTEXT_PREFIX}${issueId}`);
      this.logger.debug(`🗑️ Context deleted for issue: ${issueId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to delete context for issue ${issueId}: ${error}`,
      );
    }
  }

  async getProjectIssueIds(projectId: string): Promise<string[]> {
    try {
      const keys = await this.redisService.keys(
        `${this.INDEX_PREFIX}${projectId}:*`,
      );
      return keys.map((k) =>
        k.replace(`${this.INDEX_PREFIX}${projectId}:`, ''),
      );
    } catch {
      return [];
    }
  }

  private async addToProjectIndex(
    projectId: string,
    issueId: string,
  ): Promise<void> {
    try {
      const key = `${this.INDEX_PREFIX}${projectId}`;
      await this.redisService.set(
        key,
        JSON.stringify({ issueId }),
        this.CONTEXT_TTL,
      );
    } catch (error) {
      this.logger.error(`❌ Failed to add to project index: ${error}`);
    }
  }

  async searchBySimilarity(
    projectId: string,
    query: string,
    limit: number = 5,
  ): Promise<IssueContextData[]> {
    const issueIds = await this.getProjectIssueIds(projectId);
    const contexts: IssueContextData[] = [];

    for (const issueId of issueIds.slice(0, 20)) {
      const context = await this.getContext(issueId);
      if (context) {
        contexts.push(context);
      }
    }

    return this.rankBySimilarity(contexts, query, limit);
  }

  private rankBySimilarity(
    contexts: IssueContextData[],
    query: string,
    limit: number,
  ): IssueContextData[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    const scored = contexts.map((context) => {
      let score = 0;
      const titleWords = context.title.toLowerCase().split(/\s+/);
      const initialWords = context.initialMessage.toLowerCase().split(/\s+/);

      for (const word of queryWords) {
        if (titleWords.includes(word)) score += 10;
        if (initialWords.includes(word)) score += 5;
        if (context.title.toLowerCase().includes(word)) score += 3;
        if (context.initialMessage.toLowerCase().includes(word)) score += 1;
      }

      return { context, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.context);
  }
}
