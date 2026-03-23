# Rule: Dependency Inversion Principle
**Category:** architecture  
**Impact:** HIGH  
**Tags:** solid, dependency-inversion, di, abstraction

## Description
High-level modules MUST NOT depend on low-level modules. Both MUST depend on abstractions. Abstractions MUST NOT depend on details. Details MUST depend on abstractions.

## Rules

### Define Ports in Domain Layer
```typescript
// src/core/domain/ports/search-engine.port.ts
export interface SearchEngine {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  index(document: SearchDocument): Promise<void>;
}
```

### Implement in Infrastructure Layer
```typescript
// src/infrastructure/search/bm25/bm25-search.engine.ts
@Injectable()
export class BM25SearchEngine implements SearchEngine {
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // BM25 algorithm implementation
  }
  
  async index(document: SearchDocument): Promise<void> {
    // Indexing logic
  }
}
```

### Inject Dependencies via Constructor
```typescript
// Application layer depends on abstraction, not implementation
export class SearchRulesHandler {
  constructor(
    private readonly searchEngine: SearchEngine, // ✅ Abstraction
    private readonly ruleRepository: RuleRepository,
  ) {}
  
  async execute(query: SearchRulesQuery): Promise<SearchResult[]> {
    return await this.searchEngine.search(query.text);
  }
}
```

### Use NestJS Dependency Injection
```typescript
// Module binding
@Module({
  providers: [
    {
      provide: 'SEARCH_ENGINE',
      useClass: BM25SearchEngine, // Can be swapped easily
    },
    SearchRulesHandler,
  ],
})
export class RulesModule {}
```

## Benefits
- Easy to swap implementations (BM25 → Elasticsearch → Vector DB)
- Testable with mocks/stubs
- Decoupled architecture
- Framework independence

## Testing Example
```typescript
describe('SearchRulesHandler', () => {
  let mockSearchEngine: SearchEngine;
  let handler: SearchRulesHandler;

  beforeEach(() => {
    mockSearchEngine = {
      search: jest.fn().mockResolvedValue([]),
      index: jest.fn(),
    };
    handler = new SearchRulesHandler(mockSearchEngine, mockRepository);
  });

  it('should call search engine with query', async () => {
    await handler.execute(new SearchRulesQuery('CQRS'));
    expect(mockSearchEngine.search).toHaveBeenCalledWith('CQRS');
  });
});
```

## Related Rules
- `CLEAN_ARCHITECTURE_LAYERS` - Layer separation
- `REPOSITORY_PATTERN` - Data access abstraction
- `INTERFACE_SEGMENTATION` - Focused interfaces
