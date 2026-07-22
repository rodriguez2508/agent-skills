/**
 * Agency Search Service
 *
 * Pre-indexes all agency resources (skills, rules, agents) and provides
 * unified vector search using TF-IDF embeddings + BM25-lite scoring.
 *
 * Used by:
 * - MCP Tool `agency_search` for direct CLI queries
 * - RouterAgent for high-confidence direct answers
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { EmbeddingService } from '@infrastructure/vector-storage/embedding.service';

export interface IndexedDocument {
  id: string;
  type: 'skill' | 'rule' | 'agent';
  name: string;
  text: string;
  embedding: number[];
  entity: any;
}

export interface SearchResult {
  id: string;
  type: 'skill' | 'rule' | 'agent';
  name: string;
  text: string;
  score: number;
  entity: any;
}

interface AgencyIndex {
  documents: IndexedDocument[];
  indexedAt: Date;
}

@Injectable()
export class AgencySearchService {
  private readonly logger = new Logger(AgencySearchService.name);
  private readonly indexes = new Map<string, AgencyIndex>();
  private readonly DIMENSION = 384;

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Pre-index all agency resources (skills + rules + agents).
   * Call this when an MCP session starts or on first query.
   */
  async buildIndex(agencyId: string): Promise<number> {
    const existing = this.indexes.get(agencyId);
    if (existing) {
      this.logger.debug(`📊 Index already exists for agency ${agencyId} (${existing.documents.length} docs)`);
      return existing.documents.length;
    }

    const startTime = Date.now();
    const documents: IndexedDocument[] = [];

    // Load all resources in parallel
    const [skills, rules, agents] = await Promise.all([
      this.repo.findSkillsByAgencyId(agencyId).catch(() => []),
      this.repo.findRulesByAgencyId(agencyId).catch(() => []),
      this.repo.findAgentsByAgencyId(agencyId).catch(() => []),
    ]);

    // Index skills
    for (const skill of skills) {
      // Enrich indexed text with common query patterns for better matching
      const enrichedText = [
        skill.name,
        skill.description || '',
        (skill.tags || []).join(' '),
        skill.promptTemplate || '',
        // Common query patterns for identity-related skills
        `nombre identidad quién eres cómo te llamas ${skill.name}`,
      ].join(' ').trim();

      if (!enrichedText) continue;

      try {
        // Index document in EmbeddingService for IDF calculation
        this.embeddingService.indexDocument(`skill:${skill.id}`, enrichedText);

        const result = await this.embeddingService.generate(enrichedText, { dimension: this.DIMENSION });
        documents.push({
          id: skill.id,
          type: 'skill',
          name: skill.name,
          text: enrichedText.substring(0, 500),
          embedding: result.vector,
          entity: {
            promptTemplate: skill.promptTemplate,
            tags: skill.tags,
            isPermanent: skill.isPermanent,
            categoryId: skill.categoryId,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to index skill ${skill.name}: ${err.message}`);
      }
    }

    // Index rules
    for (const rule of rules) {
      const text = [
        rule.name,
        rule.description || '',
        rule.category || '',
        rule.ruleContent || '',
      ].join(' ').trim();

      if (!text) continue;

      try {
        this.embeddingService.indexDocument(`rule:${rule.id}`, text);

        const result = await this.embeddingService.generate(text, { dimension: this.DIMENSION });
        documents.push({
          id: rule.id,
          type: 'rule',
          name: rule.name,
          text: text.substring(0, 500),
          embedding: result.vector,
          entity: {
            ruleContent: rule.ruleContent,
            category: rule.category,
            enforcementLevel: rule.enforcementLevel,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to index rule ${rule.name}: ${err.message}`);
      }
    }

    // Index agents
    for (const agent of agents) {
      const text = [
        agent.name,
        agent.description || '',
        agent.systemPrompt || '',
        (agent.tools || []).join(' '),
      ].join(' ').trim();

      if (!text) continue;

      try {
        this.embeddingService.indexDocument(`agent:${agent.id}`, text);

        const result = await this.embeddingService.generate(text, { dimension: this.DIMENSION });
        documents.push({
          id: agent.id,
          type: 'agent',
          name: agent.name,
          text: text.substring(0, 500),
          embedding: result.vector,
          entity: {
            systemPrompt: agent.systemPrompt,
            tools: agent.tools,
            type: agent.type,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to index agent ${agent.name}: ${err.message}`);
      }
    }

    this.indexes.set(agencyId, {
      documents,
      indexedAt: new Date(),
    });

    const elapsed = Date.now() - startTime;
    this.logger.log(
      `📊 [AgencySearch] Index built for agency ${agencyId}: ${documents.length} documents (${skills.length} skills, ${rules.length} rules, ${agents.length} agents) in ${elapsed}ms`,
    );

    return documents.length;
  }

  /**
   * Search across all indexed agency resources.
   * Returns ranked results with hybrid BM25-lite + TF-IDF cosine scores.
   */
  async search(agencyId: string, query: string, limit: number = 5): Promise<SearchResult[]> {
    // Auto-build index if not yet indexed
    const index = this.indexes.get(agencyId);
    if (!index || index.documents.length === 0) {
      await this.buildIndex(agencyId);
    }

    const agencyIndex = this.indexes.get(agencyId);
    if (!agencyIndex || agencyIndex.documents.length === 0) {
      return [];
    }

    const { documents } = agencyIndex;

    // Generate query embedding
    const queryEmb = await this.embeddingService.generate(query, { dimension: this.DIMENSION });
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    // Score each document with hybrid BM25-lite + cosine
    const scored: SearchResult[] = documents.map(doc => {
      let score = 0;

      // 1. BM25-lite: word overlap in name + text
      const docText = `${doc.name} ${doc.text}`.toLowerCase();
      for (const word of queryWords) {
        if (docText.includes(word)) {
          const tf = docText.split(word).length - 1;
          const idf = Math.log((documents.length + 1) / (tf + 1));
          score += idf;
        }
      }

      // 2. TF-IDF cosine similarity
      try {
        const cosine = this.embeddingService.cosineSimilarity(queryEmb.vector, doc.embedding);
        score += cosine * 5;
      } catch { /* fallback: BM25-lite only */ }

      // 3. Boost: name match gets extra points
      const nameLower = doc.name.toLowerCase();
      if (queryWords.some(w => nameLower.includes(w))) {
        score += 2;
      }

      return {
        id: doc.id,
        type: doc.type,
        name: doc.name,
        text: doc.text,
        score,
        entity: doc.entity,
      };
    });

    // Sort by score descending, return top N
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  /**
   * Invalidate index for an agency (call after resource changes).
   */
  invalidateIndex(agencyId: string): void {
    this.indexes.delete(agencyId);
    this.logger.debug(`🗑️ [AgencySearch] Index invalidated for agency ${agencyId}`);
  }

  /**
   * Check if an agency has been indexed.
   */
  isIndexed(agencyId: string): boolean {
    return this.indexes.has(agencyId) && this.indexes.get(agencyId)!.documents.length > 0;
  }
}
