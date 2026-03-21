import { Rule, RuleImpact } from '../entities/rule.entity';

describe('Rule Entity', () => {
  const mockRuleData = {
    id: 'clean-architecture',
    name: 'Clean Architecture',
    content: 'Implement Clean Architecture in NestJS',
    category: 'nestjs',
    tags: ['clean-architecture', 'nestjs'],
    impact: RuleImpact.HIGH,
  };

  it('should create a rule with valid data', () => {
    const rule = new Rule(mockRuleData);

    expect(rule.id).toBe('clean-architecture');
    expect(rule.name).toBe('Clean Architecture');
    expect(rule.category).toBe('nestjs');
    expect(rule.impact).toBe(RuleImpact.HIGH);
  });

  it('should set createdAt and updatedAt to current date if not provided', () => {
    const rule = new Rule(mockRuleData);

    expect(rule.createdAt).toBeInstanceOf(Date);
    expect(rule.updatedAt).toBeInstanceOf(Date);
  });

  it('should convert rule to object', () => {
    const rule = new Rule(mockRuleData);
    const obj = rule.toObject();

    expect(obj).toEqual({
      ...mockRuleData,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    });
  });

  it('should use provided createdAt and updatedAt dates', () => {
    const customDate = new Date('2024-01-01');
    const rule = new Rule({
      ...mockRuleData,
      createdAt: customDate,
      updatedAt: customDate,
    });

    expect(rule.createdAt).toEqual(customDate);
    expect(rule.updatedAt).toEqual(customDate);
  });
});
