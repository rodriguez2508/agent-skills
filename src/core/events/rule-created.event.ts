import { Rule } from '../domain/entities/rule.entity';

export class RuleCreatedEvent {
  constructor(public readonly rule: Rule) {}
}
