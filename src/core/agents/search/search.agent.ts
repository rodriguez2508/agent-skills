import { Injectable, Inject } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import {
  RULE_REPOSITORY,
  RuleRepository,
} from '@core/domain/ports/rule-repository.token';
import { BM25Engine } from '@infrastructure/search/bm25/bm25.engine';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { RulesEngine } from '@infrastructure/rules/rules-engine';
import { VectorStoreFactory } from '@infrastructure/vector-storage/vector-store.factory';
import { EmbeddingService } from '@infrastructure/vector-storage/embedding.service';
import { IVectorStore } from '@infrastructure/vector-storage/vector-store.interface';

/**
 * SearchAgent - Specialized agent for rule search
 * Uses BM25 algorithm for keyword search and Vector Search for semantic search
 */
@Injectable()
export class SearchAgent extends BaseAgent {
  private lastIndexedCategory?: string;
  private isIndexed = false;
  private vectorStore: IVectorStore | null = null;

  constructor(
    @Inject(RULE_REPOSITORY)
    private readonly ruleRepository: RuleRepository,
    private readonly bm25Engine: BM25Engine,
    private readonly agentLogger: AgentLoggerService,
    private readonly rulesEngine: RulesEngine,
    private readonly vectorStoreFactory: VectorStoreFactory,
    private readonly embeddingService: EmbeddingService,
  ) {
    super('SearchAgent', 'Searches code rules using BM25 + Vector Search');
  }

  /**
   * Initialize vector store (lazy loading)
   */
  private async initVectorStore(): Promise<IVectorStore> {
    if (!this.vectorStore) {
      try {
        this.vectorStore = await this.vectorStoreFactory.create({
          type: 'inmemory',
        });
        this.agentLogger.info(
          this.agentId,
          '🧠 [SEARCH] Vector store initialized (InMemory)',
        );
      } catch (error) {
        this.agentLogger.warn(
          this.agentId,
          '⚠️ [SEARCH] Vector store initialization failed, using BM25 only',
        );
      }
    }
    return this.vectorStore!;
  }

  /**
   * Index rules into vector store
   */
  private async indexRulesForVectorSearch(category?: string): Promise<void> {
    try {
      const vectorStore = await this.initVectorStore();
      const rules = category
        ? await this.ruleRepository.findByCategory(category)
        : await this.ruleRepository.findAll();

      this.agentLogger.debug(
        this.agentId,
        `📚 [SEARCH] Indexing ${rules.length} rules for vector search...`,
      );

      for (const rule of rules) {
        // Generate embedding for rule content
        const embedding = await this.embeddingService.generate(
          `${rule.name} ${rule.content} ${rule.tags.join(' ')}`,
        );

        // Store in vector store
        await vectorStore.upsert({
          id: rule.id,
          vector: embedding.vector,
          metadata: {
            ruleId: rule.id,
            title: rule.name,
            category: rule.category,
            content: rule.content,
            tags: rule.tags,
            impact: rule.impact,
          },
        });
      }

      this.agentLogger.debug(
        this.agentId,
        `✅ [SEARCH] Vector indexing completed: ${rules.length} rules`,
      );
    } catch (error) {
      this.agentLogger.error(
        this.agentId,
        `❌ [SEARCH] Vector indexing failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Handles rule search requests
   * Uses hybrid search: BM25 (keyword) + Vector Search (semantic)
   */
  protected async handle(request: AgentRequest): Promise<any> {
    const query = request.input;
    const category = request.options?.category as string | undefined;
    const limit = (request.options?.limit as number) || 5;

    this.agentLogger.info(
      this.agentId,
      `🔍 [SEARCH] Iniciando búsqueda híbrida (BM25 + Vector)`,
      {
        query: query.substring(0, 100),
        category: category || 'all',
        limit,
      },
    );

    // Re-index only if category changed or not indexed
    if (!this.isIndexed || this.lastIndexedCategory !== category) {
      this.agentLogger.info(this.agentId, '📚 [SEARCH] Indexando reglas...', {
        category: category || 'all',
      });
      const rules = category
        ? await this.ruleRepository.findByCategory(category)
        : await this.ruleRepository.findAll();

      this.bm25Engine.clear();
      rules.forEach((rule) => this.bm25Engine.index(rule));
      this.lastIndexedCategory = category;
      this.isIndexed = true;
      this.agentLogger.info(
        this.agentId,
        `✅ [SEARCH] Indexación BM25 completada: ${rules.length} reglas`,
        {
          category,
        },
      );

      // Index for vector search (async, non-blocking)
      this.indexRulesForVectorSearch(category).catch((err) => {
        this.agentLogger.error(
          this.agentId,
          `⚠️ [SEARCH] Vector indexing failed: ${err.message}`,
        );
      });
    } else {
      this.agentLogger.debug(
        this.agentId,
        '💾 [SEARCH] Usando índice en caché',
        {
          lastIndexedCategory: this.lastIndexedCategory,
        },
      );
    }

    // Search with BM25 (keyword-based)
    this.agentLogger.debug(this.agentId, '🧮 [SEARCH] Ejecutando BM25...', {
      query,
    });
    const bm25Results = this.bm25Engine.search(query, limit);

    this.agentLogger.info(
      this.agentId,
      `✅ [BM25] Búsqueda completada: ${bm25Results.length} resultados`,
      {
        query: query.substring(0, 50),
        resultsCount: bm25Results.length,
        topScore: bm25Results[0]?.score || 0,
      },
    );

    // Search with Vector Search (semantic-based)
    let vectorResults: any[] = [];
    if (this.vectorStore) {
      try {
        this.agentLogger.debug(
          this.agentId,
          '🧠 [SEARCH] Ejecutando Vector Search...',
          {
            query,
          },
        );

        const queryEmbedding = await this.embeddingService.generate(query);
        const vectorStore = await this.initVectorStore();
        const vectorSearchResults = await vectorStore.search(
          queryEmbedding.vector,
          { limit },
        );

        vectorResults = vectorSearchResults.map((result) => ({
          rule: {
            id: result.document.metadata.ruleId,
            name: result.document.metadata.title,
            category: result.document.metadata.category,
            tags: result.document.metadata.tags,
            impact: result.document.metadata.impact,
            content: result.document.metadata.content,
          },
          score: result.score,
        }));

        this.agentLogger.info(
          this.agentId,
          `✅ [VectorSearch] Búsqueda completada: ${vectorResults.length} resultados`,
          {
            topScore: vectorResults[0]?.score || 0,
          },
        );
      } catch (error) {
        this.agentLogger.warn(
          this.agentId,
          '⚠️ [VectorSearch] Search failed, using BM25 only',
          {
            error: error instanceof Error ? error.message : error,
          },
        );
      }
    }

    // Merge and deduplicate results (hybrid search)
    const mergedResults = this.mergeResults(bm25Results, vectorResults, limit);

    if (mergedResults.length === 0) {
      this.agentLogger.warn(this.agentId, '⚠️ [SEARCH] Sin resultados', {
        query: query.substring(0, 50),
      });
      return {
        message:
          "I couldn't find rules related to your search. Try using different keywords or check the available categories.",
        query,
        results: [],
        suggestion:
          'Try searching for: "Clean Architecture", "CQRS", "NestJS", or "TypeScript"',
      };
    }

    // Format results with friendly language
    const formattedResults = mergedResults.map((result, index) => ({
      position: index + 1,
      rule: {
        id: result.rule.id,
        name: result.rule.name,
        category: result.rule.category,
        tags: result.rule.tags,
        impact: result.rule.impact,
      },
      relevance: `${(result.score * 100).toFixed(1)}%`,
      summary:
        result.rule.content.substring(0, 300) +
        (result.rule.content.length > 300 ? '...' : ''),
    }));

    this.agentLogger.info(this.agentId, '📦 [SEARCH] Resultados formateados', {
      formattedCount: formattedResults.length,
    });

    return {
      message: `Great! I found ${mergedResults.length} rule${mergedResults.length === 1 ? '' : 's'} that might help you:`,
      query,
      results: formattedResults,
      metadata: {
        bm25Results: bm25Results.length,
        vectorResults: vectorResults.length,
        mergedResults: mergedResults.length,
      },
    };
  }

  /**
   * Merge BM25 and Vector Search results with reciprocal rank fusion
   */
  private mergeResults(
    bm25Results: any[],
    vectorResults: any[],
    limit: number,
  ): any[] {
    const scoreMap = new Map<string, { rule: any; score: number }>();

    // Add BM25 results with weight 0.5
    bm25Results.forEach((result, index) => {
      const rank = index + 1;
      const score = 0.5 * result.score + 0.4 * (1 / rank); // BM25 score + reciprocal rank
      scoreMap.set(result.rule.id, { rule: result.rule, score });
    });

    // Add Vector results with weight 0.5
    vectorResults.forEach((result, index) => {
      const rank = index + 1;
      const existing = scoreMap.get(result.rule.id);
      const newScore = 0.5 * result.score + 0.4 * (1 / rank);

      if (existing) {
        // Boost score if found in both
        scoreMap.set(result.rule.id, {
          rule: result.rule,
          score: existing.score + newScore + 0.2, // Bonus for appearing in both searches
        });
      } else {
        scoreMap.set(result.rule.id, { rule: result.rule, score: newScore });
      }
    });

    // Sort by score and return top results
    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
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
      'mostrar reglas',
      'listar reglas',
      'find rule',
      'look for',
      'clean architecture',
      'cqrs',
      'nestjs',
      'typescript',
    ];

    return searchKeywords.some((keyword) =>
      input.toLowerCase().includes(keyword),
    );
  }
}
