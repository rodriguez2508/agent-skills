# Clean Architecture con CQRS en NestJS

## Descripción

Implementa Clean Architecture combinada con el patrón CQRS (Command Query Responsibility Segregation) para aplicaciones NestJS escalables y mantenibles.

## Principios

### 1. Separación de Capas

```
src/
├── core/                    # Domain Layer
│   ├── domain/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   └── ports/
│   └── events/
│
├── application/             # Application Layer (CQRS)
│   ├── commands/
│   ├── queries/
│   └── ports/
│
├── infrastructure/          # Infrastructure Layer
│   ├── adapters/
│   ├── persistence/
│   └── search/
│
└── presentation/            # Presentation Layer
    ├── controllers/
    └── dto/
```

### 2. Clean Architecture

- **Domain Layer**: Sin dependencias externas
- **Application Layer**: Reglas de negocio, casos de uso
- **Infrastructure Layer**: Implementaciones concretas
- **Presentation Layer**: Controladores, DTOs

### 3. CQRS

- **Commands**: Operaciones de escritura (mutaciones)
- **Queries**: Operaciones de lectura (consultas)
- **Handlers**: Procesadores individuales por operación

## Implementación

### Entity

```typescript
export class Rule {
  public readonly id: string;
  public readonly name: string;
  public readonly content: string;
  public readonly category: string;
  public readonly tags: string[];
  public readonly impact: RuleImpact;

  constructor(data: RuleData) {
    this.id = data.id;
    this.name = data.name;
    this.content = data.content;
    this.category = data.category;
    this.tags = data.tags;
    this.impact = data.impact;
  }
}
```

### Query Handler

```typescript
@QueryHandler(SearchRulesQuery)
export class SearchRulesHandler implements IQueryHandler {
  constructor(private readonly ruleRepository: RuleRepository) {}

  async execute(query: SearchRulesQuery): Promise<SearchResult[]> {
    const rules = await this.ruleRepository.findByCategory(query.category);
    return this.bm25Search(rules, query.query, query.limit);
  }
}
```

### Repository Port

```typescript
export interface RuleRepository {
  findById(id: string): Promise<Rule | null>;
  findAll(): Promise<Rule[]>;
  findByCategory(category: string): Promise<Rule[]>;
  save(rule: Rule): Promise<void>;
}
```

## Beneficios

- ✅ **Testabilidad**: Cada capa se prueba independientemente
- ✅ **Mantenibilidad**: Cambios aislados por capa
- ✅ **Escalabilidad**: CQRS permite optimizar lecturas/escrituras
- ✅ **Flexibilidad**: Cambiar infraestructura sin afectar dominio

## tags: [clean-architecture, cqrs, nestjs, hexagonal]
