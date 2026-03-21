import { Rule } from '../entities/rule.entity';

export class RuleCreatedEvent {
  constructor(public readonly rule: Rule) {}
}
