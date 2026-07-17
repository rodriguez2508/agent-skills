/**
 * Web Search Agent
 *
 * Agente especializado en búsqueda web usando Exa AI
 * Integra con el sistema de agentes existente
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ExaSearchAdapter,
  SearchResult,
} from '@infrastructure/adapters/search/exa-search.adapter';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { AgentRequest, AgentResponse } from '@core/agents/agent-response';
import { IAgent } from '@core/agents/agent.port';

@Injectable()
export class WebSearchAgent implements IAgent {
  readonly agentId = 'WebSearchAgent';
  readonly description = 'Agente de búsqueda web especializado usando Exa AI';

  private readonly logger = new Logger(WebSearchAgent.name);

  constructor(
    private readonly exaSearch: ExaSearchAdapter,
    private readonly configService: ConfigService,
    private readonly agentLogger: AgentLoggerService,
  ) {}

  canHandle(input: string): boolean {
    const lower = input.toLowerCase();
    return (
      lower.includes('buscar') ||
      lower.includes('search') ||
      lower.includes('web') ||
      lower.includes('internet') ||
      lower.includes('busca en google') ||
      lower.includes('search on web')
    );
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    return this.search(request.input);
  }

  private async search(input: string): Promise<AgentResponse> {
    this.agentLogger.info(
      this.agentId,
      `🔍 [WebSearch] Processing: ${input.substring(0, 100)}`,
    );

    if (!this.exaSearch.isEnabled()) {
      return {
        success: false,
        data: {
          results: [],
          message:
            'Web search is not enabled. Set EXA_ENABLED=true and EXA_API_KEY in environment.',
        },
      };
    }

    try {
      const results = await this.exaSearch.search({
        query: input,
        limit: 10,
      });

      this.agentLogger.info(
        this.agentId,
        `✅ [WebSearch] Found ${results.length} results`,
      );

      return {
        success: true,
        data: {
          results,
          query: input,
          count: results.length,
          formattedResults: this.formatSearchResults(results),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.agentLogger.error(
        this.agentId,
        `❌ [WebSearch] Error: ${errorMessage}`,
      );

      return {
        success: false,
        error: errorMessage,
        data: {
          results: [],
        },
      };
    }
  }

  private formatSearchResults(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'No search results found.';
    }

    let formatted = `🔍 **Search Results** (${results.length} found)\n\n`;

    results.forEach((result, index) => {
      formatted += `**${index + 1}. ${result.title}**\n`;
      formatted += `   📎 ${result.url}\n`;
      const snippet =
        result.snippet?.substring(0, 200) || 'No description available';
      formatted += `   ${snippet}...\n\n`;
    });

    return formatted;
  }
}
