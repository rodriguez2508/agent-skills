import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest, AgentResponse } from '@core/agents/agent-response';
import {
  AgentLoggerService,
  LogLevel,
} from '@infrastructure/logging/agent-logger.service';
import {
  RedisIssueContextService,
  IssueContextData,
} from '@infrastructure/cache/redis-issue-context.service';

export interface ContextSearchResult {
  found: boolean;
  context?: IssueContextData;
  similarity: number;
  suggestion?: string;
}

@Injectable()
export class ContextAgent extends BaseAgent {
  private readonly SIMILARITY_THRESHOLD = 0.3;

  constructor(
    private readonly agentLogger: AgentLoggerService,
    private readonly redisContextService: RedisIssueContextService,
  ) {
    super('ContextAgent', 'Busca y carga contexto previo de issues en Redis');
  }

  protected async handle(request: AgentRequest): Promise<AgentResponse> {
    const input = request.input.toLowerCase();
    const projectId = request.options?.projectId;
    const projectName = request.options?.projectName;

    this.agentLogger.info(
      this.agentId,
      `🔍 Buscando contexto para proyecto: ${projectId || projectName || 'unknown'}`,
      { input: request.input.substring(0, 100) },
    );

    if (!projectId) {
      return {
        success: true,
        data: {
          message: 'No se puede buscar contexto sin proyecto.',
          found: false,
          reason: 'no_project_id',
        },
      };
    }

    const similarContexts = await this.redisContextService.searchBySimilarity(
      projectId,
      request.input,
      5,
    );

    if (similarContexts.length === 0) {
      return {
        success: true,
        data: {
          message: 'No se encontró contexto previo para este proyecto.',
          found: false,
          reason: 'no_previous_issues',
          projectId,
        },
      };
    }

    const bestMatch = similarContexts[0];
    const similarity = this.calculateSimilarity(request.input, bestMatch.title);

    this.agentLogger.info(
      this.agentId,
      `📊 Mejor coincidencia: "${bestMatch.title}" - Similitud: ${similarity.toFixed(2)}`,
      {
        bestMatchTitle: bestMatch.title,
        similarity,
      },
    );

    if (similarity >= this.SIMILARITY_THRESHOLD) {
      const contextData = await this.redisContextService.getContext(
        bestMatch.issueId,
      );

      return {
        success: true,
        data: {
          message: `Se encontró contexto previo con ${similarity.toFixed(1)}% de coincidencia.`,
          found: true,
          context: contextData,
          similarity,
          suggestion: `Continuar con el issue existente "${bestMatch.title}" para mantener el contexto.`,
        },
      };
    }

    return {
      success: true,
      data: {
        message: 'No se encontró contexto suficientemente similar.',
        found: false,
        reason: 'low_similarity',
        similarity,
        projectId,
        similarIssues: similarContexts.map((c) => ({
          issueId: c.issueId,
          title: c.title,
          createdAt: c.createdAt,
        })),
      },
    };
  }

  private calculateSimilarity(query: string, title: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const titleWords = title.toLowerCase().split(/\s+/);

    let matches = 0;
    for (const word of queryWords) {
      if (word.length < 3) continue;
      if (titleWords.some((tw) => tw.includes(word) || word.includes(tw))) {
        matches++;
      }
    }

    const maxPossible = queryWords.filter((w) => w.length >= 3).length;
    return maxPossible > 0 ? matches / maxPossible : 0;
  }
}
