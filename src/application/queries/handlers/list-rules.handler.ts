import { Inject } from '@nestjs/common';
import { QueryHandler } from '@nestjs/cqrs';
import { ListRulesQuery } from '../list-rules/list-rules.query';
import { Rule } from '@core/domain/entities/rule.entity';
import { RULE_REPOSITORY } from '@core/domain/ports/rule-repository.token';

@QueryHandler(ListRulesQuery)
export class ListRulesHandler {
  constructor(
    @Inject(RULE_REPOSITORY)
    private readonly ruleRepository: any,
  ) {}

  async execute(query: ListRulesQuery): Promise<Rule[]> {
    if (query.category) {
      const rules = await this.ruleRepository.findByCategory(query.category);
      return rules.slice(0, query.limit);
    }
    const rules = await this.ruleRepository.findAll();
    return rules.slice(0, query.limit);
  }
}
