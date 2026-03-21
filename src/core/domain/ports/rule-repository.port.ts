import { Rule } from '../entities/rule.entity';

export interface RuleRepository {
  findById(id: string): Promise<Rule | null>;
  findAll(): Promise<Rule[]>;
  findByCategory(category: string): Promise<Rule[]>;
  save(rule: Rule): Promise<void>;
  delete(id: string): Promise<void>;
}
