import { Injectable, Inject } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { RULE_REPOSITORY } from '@core/domain/ports/rule-repository.token';
import { BM25Engine } from '@infrastructure/search/bm25/bm25.engine';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { RulesEngine } from '@infrastructure/rules/rules-engine';

/**
 * SearchAgent - Specialized agent for rule search
 * Uses BM25 algorithm to find relevant rules
 */
@Injectable()
export class SearchAgent extends BaseAgent {
  constructor(
    @Inject(RULE_REPOSITORY)
    private readonly ruleRepository: any,
    private readonly bm25Engine: BM25Engine,
    private readonly agentLogger: AgentLoggerService,
    private readonly rulesEngine: RulesEngine,
  ) {
    super(
      'SearchAgent',
      'Searches code rules using BM25 algorithm',
    );
  }

  /**
   * Handles rule search requests
   */
  protected async handle(request: AgentRequest): Promise<any> {
    const query = request.input;
    const category = request.options?.category as string | undefined;
    const limit = (request.options?.limit as number) || 5;

    this.agentLogger.info(this.agentId, 'Starting search', {
      query,
      category,
      limit,
    });

    // Get rules (filtered by category if exists)
    const rules = category
      ? await this.ruleRepository.findByCategory(category)
      : await this.ruleRepository.findAll();

    this.agentLogger.debug(this.agentId, `Rules obtained: ${rules.length}`);

    // Index rules in BM25
    this.bm25Engine.clear();
    rules.forEach((rule) => this.bm25Engine.index(rule));

    // Search with BM25
    const searchResults = this.bm25Engine.search(query, limit);

    this.agentLogger.info(this.agentId, `Search completed: ${searchResults.length} results`);

    if (searchResults.length === 0) {
      return {
        message: "I couldn't find rules related to your search. Try using different keywords or check the available categories.",
        query,
        results: [],
        suggestion: 'Try searching for: "Clean Architecture", "CQRS", "NestJS", or "TypeScript"',
      };
    }

    // Format results with friendly language
    const formattedResults = searchResults.map((result, index) => ({
      position: index + 1,
      rule: {
        id: result.rule.id,
        name: result.rule.name,
        category: result.rule.category,
        tags: result.rule.tags,
        impact: result.rule.impact,
      },
      relevance: `${(result.score * 100).toFixed(1)}%`,
      summary: result.rule.content.substring(0, 300) + (result.rule.content.length > 300 ? '...' : ''),
    }));

    return {
      message: `Great! I found ${searchResults.length} rule${searchResults.length === 1 ? '' : 's'} that might help you:`,
      query,
      results: formattedResults,
    };
  }

  /**
   * Checks if this agent can handle the input
   */
  canHandle(input: string): boolean {
    const searchKeywords = [
      'buscar',
      'encuentra',
      'search',
      'qué hay',
      'mostrar',
      'cómo',
      'cuál',
      'quiero',
      'necesito',
      'find',
      'look for',
    ];

    return searchKeywords.some((keyword) => input.toLowerCase().includes(keyword));
  }
}
