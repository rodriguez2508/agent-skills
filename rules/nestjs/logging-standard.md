# Rule: Logging Standard
**Category:** nestjs  
**Impact:** MEDIUM  
**Tags:** logging, monitoring, debugging, observability

## Description
Logging MUST be consistent, structured, and follow a standard format across all layers of the application.

## Rules

### Log Levels Usage
```typescript
// ERROR - Application errors that need attention
this.logger.error('Database connection failed', error.stack);

// WARN - Unexpected but handled situations
this.logger.warn('Cache miss for frequently accessed rule', { ruleId });

// INFO - Important business events
this.logger.info('Rule created successfully', { ruleId, ruleName });

// DEBUG - Detailed technical information
this.logger.debug('BM25 search executed', { query, results: 15, time: '45ms' });

// VERBOSE - Very detailed diagnostic information
this.logger.verbose('Request received', { method, url, headers });
```

### Structured Logging
```typescript
// ❌ WRONG - Unstructured log
this.logger.info('Rule ' + ruleId + ' was created by user ' + userId);

// ✅ CORRECT - Structured log
this.logger.info('Rule created', {
  ruleId,
  userId,
  ruleName: rule.name,
  category: rule.category,
  timestamp: new Date().toISOString(),
});
```

### Custom Logger Service
```typescript
// src/infrastructure/logging/agent-logger.service.ts
@Injectable()
export class AgentLoggerService {
  private readonly logger = new Logger(AgentLoggerService.name);

  info(
    agentId: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    this.logger.log(message, {
      agentId,
      ...context,
      level: 'INFO',
      timestamp: new Date().toISOString(),
    });
  }

  error(
    agentId: string,
    message: string,
    error?: Error | unknown,
    context?: Record<string, unknown>,
  ): void {
    this.logger.error(message, error?.stack, {
      agentId,
      error: error instanceof Error ? error.message : String(error),
      ...context,
      level: 'ERROR',
      timestamp: new Date().toISOString(),
    });
  }

  warn(
    agentId: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    this.logger.warn(message, {
      agentId,
      ...context,
      level: 'WARN',
      timestamp: new Date().toISOString(),
    });
  }

  debug(
    agentId: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (process.env.DEBUG === 'true') {
      this.logger.debug(message, {
        agentId,
        ...context,
        level: 'DEBUG',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

### Request/Response Logging
```typescript
// src/infrastructure/middleware/logging.middleware.ts
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: Logger) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = request;
    const startTime = Date.now();

    response.on('finish', () => {
      const { statusCode } = response;
      const duration = Date.now() - startTime;

      this.logger.log(`${method} ${originalUrl} ${statusCode} - ${duration}ms`, {
        method,
        url: originalUrl,
        statusCode,
        duration,
        ip,
        userAgent: request.headers['user-agent'],
      });
    });

    next();
  }
}
```

### Agent-Specific Logging
```typescript
// In agents (RouterAgent, SearchAgent, etc.)
@Injectable()
export class SearchAgent extends BaseAgent {
  constructor(
    private readonly agentLogger: AgentLoggerService,
    private readonly searchEngine: SearchEngine,
  ) {
    super('SearchAgent', 'Searches rules using BM25');
  }

  protected async handle(request: AgentRequest): Promise<AgentResponse> {
    this.agentLogger.info(this.agentId, '🔍 Starting search', {
      query: request.input,
      filters: request.options,
    });

    const results = await this.searchEngine.search(request.input);

    this.agentLogger.info(this.agentId, '✅ Search completed', {
      resultsCount: results.length,
      executionTime: Date.now() - startTime,
    });

    return { success: true, data: { results } };
  }
}
```

### Log Context Prefix
```typescript
// Use emoji prefixes for visual categorization
📥 - Incoming request/data
📤 - Outgoing response/data
🔍 - Search operations
🧠 - Decision/detection logic
⚠️ - Warnings
✅ - Successful operations
❌ - Failed operations
🔀 - Routing/orchestration
▶️ - Execution start
⏹️ - Execution end
```

### Environment-Based Logging
```typescript
// config/logging.config.ts
export const loggingConfig = () => ({
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json', // json | text
    output: process.env.LOG_OUTPUT || 'stdout', // stdout | file
    file: {
      path: process.env.LOG_FILE_PATH || 'logs',
      filename: process.env.LOG_FILENAME || 'app.log',
      maxSize: process.env.LOG_MAX_SIZE || '10m',
      maxFiles: process.env.LOG_MAX_FILES || '5',
    },
  },
});
```

## Related Rules
- `ERROR_HANDLING` - Error handling patterns
- `MONITORING_METRICS` - Application monitoring
- `REQUEST_TRACKING` - Request correlation
