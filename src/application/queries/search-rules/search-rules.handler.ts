import { Inject } from '@nestjs/common';
import { QueryHandler } from '@nestjs/cqrs';
import { SearchRulesQuery } from './search-rules.query';
import { Rule } from '@core/domain/entities/rule.entity';
import { RULE_REPOSITORY, RuleRepository } from '@core/domain/ports/rule-repository.token';
import { BM25Engine } from '@infrastructure/search/bm25/bm25.engine';

export interface SearchResult {
  rule: Rule;
  score: number;
}

@QueryHandler(SearchRulesQuery)
export class SearchRulesHandler {
  constructor(
    @Inject(RULE_REPOSITORY)
    private readonly ruleRepository: RuleRepository,
    private readonly bm25Engine: BM25Engine,
  ) {}

  async execute(query: SearchRulesQuery): Promise<SearchResult[]> {
    const rules = query.category
      ? await this.ruleRepository.findByCategory(query.category)
      : await this.ruleRepository.findAll();

    // Index rules in BM25 engine
    this.bm25Engine.clear();
    rules.forEach((rule) => this.bm25Engine.index(rule));

    // Search using BM25 algorithm
    return this.bm25Engine.search(query.query, query.limit);
  }
}
