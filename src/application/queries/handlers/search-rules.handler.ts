import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { SearchRulesQuery } from './search-rules.query';
import { RuleRepository } from '../../../core/domain/ports/rule-repository.port';
import { Rule } from '../../../core/domain/entities/rule.entity';

export interface SearchResult {
  rule: Rule;
  score: number;
}

@QueryHandler(SearchRulesQuery)
export class SearchRulesHandler implements IQueryHandler<SearchRulesQuery, SearchResult[]> {
  constructor(private readonly ruleRepository: RuleRepository) {}

  async execute(query: SearchRulesQuery): Promise<SearchResult[]> {
    const rules = query.category
      ? await this.ruleRepository.findByCategory(query.category)
      : await this.ruleRepository.findAll();

    const results = this.bm25Search(rules, query.query, query.limit);
    return results;
  }

  private bm25Search(rules: Rule[], searchTerm: string, limit: number): SearchResult[] {
    const tokens = this.tokenize(searchTerm.toLowerCase());
    const results: SearchResult[] = [];

    for (const rule of rules) {
      const score = this.calculateScore(rule, tokens);
      if (score > 0) {
        results.push({ rule, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private tokenize(text: string): string[] {
    return text
      .split(/\s+/)
      .filter((token) => token.length > 0)
      .filter((token) => !this.isStopWord(token));
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being'];
    return stopWords.includes(word);
  }

  private calculateScore(rule: Rule, tokens: string[]): number {
    let score = 0;
    const content = `${rule.name} ${rule.content} ${rule.tags.join(' ')}`.toLowerCase();

    for (const token of tokens) {
      if (content.includes(token)) {
        score += 1;
      }
    }

    return score;
  }
}
