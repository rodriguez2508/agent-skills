# Rule: NestJS Module Organization
**Category:** nestjs  
**Impact:** HIGH  
**Tags:** nestjs, modules, organization, structure

## Description
NestJS modules MUST follow a consistent organization pattern based on feature domains and architectural layers.

## Rules

### Module Structure
```
src/
├── modules/
│   ├── rules/
│   │   ├── rules.module.ts
│   │   ├── application/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── presentation/
│   ├── users/
│   ├── auth/
│   └── sessions/
├── core/
├── application/
├── infrastructure/
└── presentation/
```

### Module Definition
```typescript
// src/modules/rules/rules.module.ts
@Module({
  imports: [
    // External modules
    CqrsModule,
    TypeOrmModule.forFeature([RuleEntity]),
    
    // Internal feature modules
    AuthModule,
    
    // Configuration
    ConfigModule.forFeature(rulesConfig),
  ],
  controllers: [RulesController],
  providers: [
    // Application
    CreateRuleHandler,
    GetRuleHandler,
    SearchRulesHandler,
    
    // Infrastructure
    {
      provide: 'RULE_REPOSITORY',
      useClass: RuleTypeormRepository,
    },
    {
      provide: 'SEARCH_ENGINE',
      useClass: BM25SearchEngine,
    },
    
    // Domain services
    RuleDomainService,
  ],
  exports: [
    // Ports that other modules can use
    'RULE_REPOSITORY',
    RuleDomainService,
  ],
})
export class RulesModule {}
```

### Controller Pattern
```typescript
// src/modules/rules/presentation/controllers/rules.controller.ts
@Controller('rules')
@ApiTags('rules')
export class RulesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all rules' })
  async listRules(): Promise<RuleResponseDto[]> {
    const rules = await this.queryBus.execute(new ListRulesQuery());
    return plainToClass(RuleResponseDto, rules);
  }

  @Get(':id')
  async getRule(@Param('id') id: string): Promise<RuleResponseDto> {
    const rule = await this.queryBus.execute(new GetRuleQuery(id));
    return plainToClass(RuleResponseDto, rule);
  }

  @Post()
  async createRule(
    @Body() dto: CreateRuleDto,
  ): Promise<RuleResponseDto> {
    const command = plainToClass(CreateRuleCommand, dto);
    const rule = await this.commandBus.execute(command);
    return plainToClass(RuleResponseDto, rule);
  }
}
```

### Configuration Pattern
```typescript
// src/modules/rules/rules.config.ts
export const rulesConfig = () => ({
  rules: {
    maxResults: parseInt(process.env.RULES_MAX_RESULTS, 10) || 100,
    cacheEnabled: process.env.RULES_CACHE_ENABLED === 'true',
    cacheTtl: parseInt(process.env.RULES_CACHE_TTL, 10) || 300,
  },
});

// Usage in module
ConfigModule.forFeature(rulesConfig)

// Usage in service
constructor(@InjectConfig('rules') private config: RulesConfig) {}
```

### Shared Module Pattern
```typescript
// src/shared/shared.module.ts
@Module({
  providers: [
    LoggerService,
    ValidationService,
    {
      provide: 'APP_GUARD',
      useClass: AuthGuard,
    },
  ],
  exports: [
    LoggerService,
    ValidationService,
  ],
})
export class SharedModule {}
```

## Module Communication
- Modules MUST communicate through public exports only
- Direct imports from other module internals are FORBIDDEN
- Use events for cross-module side effects

## Related Rules
- `CLEAN_ARCHITECTURE_LAYERS` - Layer organization
- `CQRS_PATTERN` - Command/Query handlers
- `DEPENDENCY_INJECTION` - DI best practices
