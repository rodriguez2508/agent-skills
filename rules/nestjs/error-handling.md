# Rule: Error Handling Standard
**Category:** nestjs  
**Impact:** HIGH  
**Tags:** error-handling, exceptions, filters, logging

## Description
Errors MUST be handled consistently across the application using NestJS exception filters and custom error types.

## Rules

### Custom Exception Classes
```typescript
// src/core/exceptions/domain-exception.ts
export abstract class DomainException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus,
    public readonly code: string,
    public readonly context: string,
  ) {
    super({
      statusCode,
      message,
      code,
      context,
      timestamp: new Date().toISOString(),
    }, statusCode);
  }
}

// Specific exceptions
export class RuleNotFoundException extends DomainException {
  constructor(ruleId: string) {
    super(
      `Rule with id "${ruleId}" not found`,
      HttpStatus.NOT_FOUND,
      'RULE_NOT_FOUND',
      'RulesModule',
    );
  }
}

export class InvalidRuleException extends DomainException {
  constructor(reasons: string[]) {
    super(
      `Invalid rule: ${reasons.join(', ')}`,
      HttpStatus.BAD_REQUEST,
      'INVALID_RULE',
      'RulesModule',
    );
  }
}
```

### Exception Filters
```typescript
// src/infrastructure/filters/domain-exception.filter.ts
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const exceptionResponse = exception.getResponse() as any;

    this.logger.error({
      message: exceptionResponse.message,
      code: exceptionResponse.code,
      context: exceptionResponse.context,
      url: request.url,
      method: request.method,
      ip: request.ip,
    });

    response.status(exceptionResponse.statusCode).json({
      ...exceptionResponse,
      path: request.url,
    });
  }
}
```

### Global Filter Registration
```typescript
// src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalFilters(new DomainExceptionFilter(new Logger()));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalFilters(new QueryFailedErrorFilter());
  
  await app.listen(3000);
}
```

### Try-Catch Pattern in Handlers
```typescript
// ✅ CORRECT - Handle expected failures
export class GetRuleHandler {
  async execute(query: GetRuleQuery): Promise<Rule> {
    try {
      const rule = await this.ruleRepository.findById(query.id);
      
      if (!rule) {
        throw new RuleNotFoundException(query.id);
      }
      
      return rule;
    } catch (error) {
      if (error instanceof RuleNotFoundException) {
        throw error; // Re-throw domain exceptions
      }
      
      // Log unexpected errors
      this.logger.error('Unexpected error in GetRuleHandler', error);
      throw new InternalServerErrorException('Failed to get rule');
    }
  }
}
```

### Error Response Format
```json
{
  "statusCode": 404,
  "message": "Rule with id \"123\" not found",
  "code": "RULE_NOT_FOUND",
  "context": "RulesModule",
  "timestamp": "2026-03-23T10:00:00.000Z",
  "path": "/rules/123"
}
```

### Logging Errors
```typescript
// ❌ WRONG - Silent failure
try {
  await this.repository.save(entity);
} catch (error) {
  return null;
}

// ✅ CORRECT - Log and rethrow or handle
try {
  await this.repository.save(entity);
} catch (error) {
  this.logger.error('Failed to save entity', {
    error: error.message,
    stack: error.stack,
    entityId: entity.id,
  });
  throw new DatabaseException('Failed to save entity');
}
```

## Related Rules
- `LOGGING_STANDARD` - Consistent logging
- `VALIDATION_PATTERN` - Input validation
- `TRANSACTION_MANAGEMENT` - Error handling in transactions
