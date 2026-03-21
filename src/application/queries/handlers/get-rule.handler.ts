import { Inject } from '@nestjs/common';
import { QueryHandler } from '@nestjs/cqrs';
import { GetRuleQuery } from '../get-rule/get-rule.query';
import { Rule } from '@core/domain/entities/rule.entity';
import { RULE_REPOSITORY } from '@core/domain/ports/rule-repository.token';

@QueryHandler(GetRuleQuery)
export class GetRuleHandler {
  constructor(
    @Inject(RULE_REPOSITORY)
    private readonly ruleRepository: any,
  ) {}

  async execute(query: GetRuleQuery): Promise<Rule | null> {
    return this.ruleRepository.findById(query.id);
  }
}
