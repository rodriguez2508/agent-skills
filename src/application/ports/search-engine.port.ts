import { Rule } from '@core/domain/entities/rule.entity';

export interface SearchResult {
  rule: Rule;
  score: number;
}

export interface SearchEngine {
  index(rule: Rule): void;
  search(query: string, limit?: number): SearchResult[];
  searchByCategory(
    query: string,
    category: string,
    limit?: number,
  ): SearchResult[];
  remove(ruleId: string): void;
  clear(): void;
}
