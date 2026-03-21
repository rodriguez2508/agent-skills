import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { ListRulesQuery } from '../list-rules/list-rules.query';
import { RuleRepository } from '../../../core/domain/ports/rule-repository.port';
import { Rule } from '../../../core/domain/entities/rule.entity';

@QueryHandler(ListRulesQuery)
export class ListRulesHandler implements IQueryHandler<ListRulesQuery, Rule[]> {
  constructor(private readonly ruleRepository: RuleRepository) {}

  async execute(query: ListRulesQuery): Promise<Rule[]> {
    if (query.category) {
      const rules = await this.ruleRepository.findByCategory(query.category);
      return rules.slice(0, query.limit);
    }
    const rules = await this.ruleRepository.findAll();
    return rules.slice(0, query.limit);
  }
}
