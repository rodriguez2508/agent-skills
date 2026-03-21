import { BM25Engine } from './bm25.engine';
import { Rule, RuleImpact } from '../../../core/domain/entities/rule.entity';

describe('BM25Engine', () => {
  let engine: BM25Engine;

  beforeEach(() => {
    engine = new BM25Engine({ k1: 1.5, b: 0.75 });
  });

  const createMockRule = (id: string, name: string, content: string, category: string): Rule => {
    return new Rule({
      id,
      name,
      content,
      category,
      tags: ['test'],
      impact: RuleImpact.MEDIUM,
    });
  };

  describe('index', () => {
    it('should index a rule successfully', () => {
      const rule = createMockRule('1', 'Test Rule', 'Test content', 'nestjs');
      
      expect(() => engine.index(rule)).not.toThrow();
    });

    it('should index multiple rules', () => {
      const rule1 = createMockRule('1', 'Rule 1', 'Content 1', 'nestjs');
      const rule2 = createMockRule('2', 'Rule 2', 'Content 2', 'angular');

      engine.index(rule1);
      engine.index(rule2);

      expect(engine.search('content')).toHaveLength(2);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      engine.index(createMockRule('1', 'Clean Architecture', 'Implement CQRS pattern in NestJS', 'nestjs'));
      engine.index(createMockRule('2', 'Dependency Injection', 'Use providers and modules', 'nestjs'));
      engine.index(createMockRule('3', 'Angular Components', 'Create standalone components with signals', 'angular'));
    });

    it('should return results matching the query', () => {
      const results = engine.search('CQRS NestJS');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].rule.id).toBe('1');
    });

    it('should return empty array for non-matching query', () => {
      const results = engine.search('python django');

      expect(results).toHaveLength(0);
    });

    it('should respect limit parameter', () => {
      const results = engine.search('NestJS', 1);

      expect(results).toHaveLength(1);
    });

    it('should return results sorted by score', () => {
      const results = engine.search('NestJS');

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  describe('searchByCategory', () => {
    beforeEach(() => {
      engine.index(createMockRule('1', 'Clean Architecture', 'Implement CQRS pattern in NestJS', 'nestjs'));
      engine.index(createMockRule('2', 'Dependency Injection', 'Use providers and modules', 'nestjs'));
      engine.index(createMockRule('3', 'Angular Components', 'Create standalone components', 'angular'));
    });

    it('should filter results by category', () => {
      const results = engine.searchByCategory('NestJS', 'nestjs');

      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result.rule.category).toBe('nestjs');
      });
    });

    it('should return empty array for non-matching category', () => {
      const results = engine.searchByCategory('NestJS', 'react');

      expect(results).toHaveLength(0);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      engine.index(createMockRule('1', 'Test Rule', 'Test content', 'nestjs'));
    });

    it('should remove a rule from the index', () => {
      engine.remove('1');

      const results = engine.search('Test');
      expect(results).toHaveLength(0);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      engine.index(createMockRule('1', 'Rule 1', 'Content 1', 'nestjs'));
      engine.index(createMockRule('2', 'Rule 2', 'Content 2', 'angular'));
    });

    it('should remove all rules from the index', () => {
      engine.clear();

      expect(engine.search('content')).toHaveLength(0);
    });
  });
});
