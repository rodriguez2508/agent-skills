import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetRuleQuery } from '../get-rule/get-rule.query';
import { RuleRepository } from '../../../core/domain/ports/rule-repository.port';
import { Rule } from '../../../core/domain/entities/rule.entity';

@QueryHandler(GetRuleQuery)
export class GetRuleHandler implements IQueryHandler<GetRuleQuery, Rule | null> {
  constructor(private readonly ruleRepository: RuleRepository) {}

  async execute(query: GetRuleQuery): Promise<Rule | null> {
    return this.ruleRepository.findById(query.id);
  }
}
