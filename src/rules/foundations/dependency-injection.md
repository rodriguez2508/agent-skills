# Inyección de Dependencias en NestJS

## Descripción

Usa el sistema de inyección de dependencias de NestJS para crear componentes desacoplados y testables siguiendo principios SOLID.

## Principios

### 1. Inversión de Dependencias

Depende de abstracciones, no de implementaciones concretas.

```typescript
// ❌ MAL: Acoplamiento fuerte
@Injectable()
export class RulesService {
  private repository = new RuleFileRepository();
}

// ✅ BIEN: Dependencia inyectada
@Injectable()
export class RulesService {
  constructor(
    private readonly repository: RuleRepository,
  ) {}
}
```

### 2. Providers

```typescript
@Injectable()
export class BM25Engine implements SearchEngine {
  index(rule: Rule): void {
    // Implementación
  }

  search(query: string): SearchResult[] {
    // Implementación
  }
}
```

### 3. Módulos

```typescript
@Module({
  imports: [CqrsModule],
  providers: [
    RulesService,
    BM25Engine,
    {
      provide: 'RULE_REPOSITORY',
      useClass: RuleFileRepository,
    },
  ],
  exports: [RulesService],
})
export class RulesModule {}
```

### 4. Custom Providers

```typescript
// Factory provider
{
  provide: 'CONFIG_OPTIONS',
  useFactory: (configService: ConfigService) => ({
    k1: configService.get('BM25_K1', 1.5),
    b: configService.get('BM25_B', 0.75),
  }),
  inject: [ConfigService],
}

// Value provider
{
  provide: 'GRPC_PORT',
  useValue: 50051,
}
```

## Ciclo de Vida

### OnModuleInit

```typescript
@Injectable()
export class GrpcServer implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    // Inicializar servidor gRPC
  }
}
```

### OnModuleDestroy

```typescript
@Injectable()
export class GrpcServer implements OnModuleDestroy {
  onModuleDestroy(): void {
    // Limpiar recursos
  }
}
```

## tags: [dependency-injection, nestjs, providers, modules, SOLID]
