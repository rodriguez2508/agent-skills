/**
 * Context Service
 *
 * Application service for managing conversation contexts.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ContextRepository,
  CreateContextDto,
} from '../../infrastructure/persistence/context.repository';
import { ContextType } from '@modules/contexts/domain/entities/context.entity';

@Injectable()
export class ContextService {
  private readonly logger = new Logger(ContextService.name);

  constructor(private readonly contextRepository: ContextRepository) {}

  async createContext(data: CreateContextDto) {
    this.logger.log(
      `📝 Creating context for issue: ${data.issueId}, type: ${data.type}`,
    );

    // Deactivate previous active contexts for this issue
    await this.contextRepository.deactivateAllForIssue(data.issueId);

    const context = await this.contextRepository.create(data);

    this.logger.log(`✅ Context created: ${context.id} (${context.contextId})`);

    return {
      id: context.id,
      contextId: context.contextId,
      issueId: context.issueId,
      type: context.type,
      summary: context.summary,
      isActive: context.isActive,
      createdAt: context.createdAt,
    };
  }

  async getContextById(id: string) {
    return this.contextRepository.findById(id);
  }

  async getContextsByIssue(issueId: string) {
    return this.contextRepository.findByIssueId(issueId);
  }

  async getActiveContext(issueId: string) {
    return this.contextRepository.findActiveByIssueId(issueId);
  }

  async addMessage(
    id: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
  ) {
    return this.contextRepository.addMessage(id, { role, content });
  }

  async detectContextType(input: string): Promise<ContextType> {
    const lower = input.toLowerCase();

    if (
      lower.includes('analiza') ||
      lower.includes('analyze') ||
      lower.includes('análisis')
    ) {
      return ContextType.ANALYSIS;
    }
    if (
      lower.includes('implementa') ||
      lower.includes('implement') ||
      lower.includes('crea') ||
      lower.includes('codigo')
    ) {
      return ContextType.IMPLEMENTATION;
    }
    if (
      lower.includes('busca') ||
      lower.includes('search') ||
      lower.includes('investiga') ||
      lower.includes('research')
    ) {
      return ContextType.RESEARCH;
    }
    if (
      lower.includes('revis') ||
      lower.includes('review') ||
      lower.includes('revisar')
    ) {
      return ContextType.REVIEW;
    }
    if (
      lower.includes('comando') ||
      lower.includes('command') ||
      lower.includes('ejecuta')
    ) {
      return ContextType.COMMAND;
    }

    return ContextType.DISCUSSION;
  }

  async updateContextSummary(id: string, summary: string) {
    return this.contextRepository.update(id, { summary });
  }

  async updateExtractedInfo(id: string, extractedInfo: any) {
    return this.contextRepository.update(id, { extractedInfo });
  }
}
