# Rule: Testing Pattern
**Category:** testing  
**Impact:** HIGH  
**Tags:** testing, jest, unit-tests, integration-tests

## Description
All business logic MUST be covered by unit tests. Integration tests MUST cover critical paths. Test files MUST follow naming conventions.

## Rules

### Test File Naming
```
src/
├── application/
│   ├── commands/
│   │   └── create-rule/
│   │       └── handlers/
│   │           ├── create-rule.handler.spec.ts  ✅
│   │           └── create-rule.handler.ts
├── domain/
│   └── entities/
│       └── rule.entity.spec.ts  ✅
└── infrastructure/
    └── repositories/
        └── rule.repository.spec.ts  ✅
```

### Unit Test Structure (AAA Pattern)
```typescript
// src/application/commands/create-rule/handlers/create-rule.handler.spec.ts
import { CreateRuleHandler } from './create-rule.handler';
import { CreateRuleCommand } from './create-rule.command';
import { RuleRepository } from '@core/domain/ports/rule-repository.port';
import { Rule } from '@core/domain/entities/rule.entity';

describe('CreateRuleHandler', () => {
  let handler: CreateRuleHandler;
  let mockRuleRepository: jest.Mocked<RuleRepository>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    mockRuleRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
    };

    mockEventPublisher = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    };

    handler = new CreateRuleHandler(mockRuleRepository, mockEventPublisher);
  });

  describe('execute', () => {
    it('should create a rule successfully', async () => {
      // Arrange
      const command = new CreateRuleCommand(
        'Test Rule',
        'Rule content',
        'testing',
      );
      
      const expectedRule = new Rule({
        id: 'test-id',
        name: 'Test Rule',
        content: 'Rule content',
        category: 'testing',
        tags: ['test'],
        impact: 'MEDIUM',
      });

      mockRuleRepository.create.mockResolvedValue(expectedRule);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result).toEqual(expectedRule);
      expect(mockRuleRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Rule',
          content: 'Rule content',
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });

    it('should throw InvalidRuleException when rule is invalid', async () => {
      // Arrange
      const command = new CreateRuleCommand('', '', ''); // Invalid data

      // Act & Assert
      await expect(handler.execute(command))
        .rejects
        .toThrow(InvalidRuleException);
    });
  });
});
```

### Domain Entity Tests
```typescript
// src/core/domain/entities/rule.entity.spec.ts
import { Rule, RuleImpact } from './rule.entity';

describe('Rule Entity', () => {
  describe('create', () => {
    it('should create a valid rule', () => {
      const rule = Rule.create({
        name: 'Test Rule',
        content: 'Content',
        category: 'testing',
      });

      expect(rule.name).toBe('Test Rule');
      expect(rule.category).toBe('testing');
      expect(rule.impact).toBe(RuleImpact.MEDIUM);
      expect(rule.createdAt).toBeDefined();
    });

    it('should throw error when name is empty', () => {
      expect(() => {
        Rule.create({ name: '', content: 'Content', category: 'testing' });
      }).toThrow('Rule name cannot be empty');
    });

    it('should throw error when content exceeds max length', () => {
      const longContent = 'a'.repeat(10001);
      
      expect(() => {
        Rule.create({ 
          name: 'Test', 
          content: longContent, 
          category: 'testing' 
        });
      }).toThrow('Rule content exceeds maximum length');
    });
  });

  describe('update', () => {
    it('should update rule properties', () => {
      const rule = new Rule({
        id: 'test-id',
        name: 'Original',
        content: 'Original content',
        category: 'original',
        tags: ['tag1'],
        impact: RuleImpact.LOW,
      });

      rule.update({
        name: 'Updated',
        content: 'Updated content',
      });

      expect(rule.name).toBe('Updated');
      expect(rule.content).toBe('Updated content');
      expect(rule.category).toBe('original'); // Unchanged
    });
  });
});
```

### Integration Test Pattern
```typescript
// test/rules.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Rules (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/rules (POST)', () => {
    it('should create a new rule', () => {
      return request(app.getHttpServer())
        .post('/rules')
        .send({
          name: 'E2E Test Rule',
          content: 'Rule content for testing',
          category: 'e2e-testing',
          tags: ['test', 'e2e'],
          impact: 'HIGH',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.name).toBe('E2E Test Rule');
        });
    });
  });

  describe('/rules/:id (GET)', () => {
    it('should get a rule by id', async () => {
      // First create a rule
      const createResponse = await request(app.getHttpServer())
        .post('/rules')
        .send({
          name: 'Get Test Rule',
          content: 'Content',
          category: 'test',
        });

      const ruleId = createResponse.body.id;

      // Then get it
      return request(app.getHttpServer())
        .get(`/rules/${ruleId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(ruleId);
          expect(res.body.name).toBe('Get Test Rule');
        });
    });

    it('should return 404 for non-existent rule', () => {
      return request(app.getHttpServer())
        .get('/rules/non-existent-id')
        .expect(404);
    });
  });
});
```

### Test Coverage Requirements
```json
// package.json
{
  "scripts": {
    "test:cov": "jest --coverage --coverageThreshold='{\"global\":{\"branches\":80,\"functions\":80,\"lines\":80,\"statements\":80}}'"
  }
}
```

## Related Rules
- `MOCKING_PATTERN` - Mock external dependencies
- `TEST_DATA_FACTORIES` - Test data generation
- `ARRANGE_ACT_ASSERT` - Test structure
