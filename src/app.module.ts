import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

// Infrastructure
import { BM25Engine } from '@infrastructure/search/bm25/bm25.engine';
import { RuleFileRepository } from '@infrastructure/persistence/repositories/rule-file.repository';
import { GrpcServerAdapter } from '@infrastructure/adapters/grpc/grpc-server.adapter';

// Presentation
import { HealthController } from '@presentation/controllers/health/health.controller';
import { RulesController } from '@presentation/controllers/rules/rules.controller';
import { McpController } from '@presentation/controllers/mcp/mcp.controller';

// Application Handlers
import { SearchRulesHandler } from '@application/queries/handlers/search-rules.handler';
import { GetRuleHandler } from '@application/queries/handlers/get-rule.handler';
import { ListRulesHandler } from '@application/queries/handlers/list-rules.handler';

// Domain
import { RULE_REPOSITORY } from '@core/domain/ports/rule-repository.token';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CqrsModule,
  ],
  controllers: [HealthController, RulesController, McpController],
  providers: [
    // Infrastructure
    BM25Engine,
    {
      provide: RULE_REPOSITORY,
      useClass: RuleFileRepository,
    },
    GrpcServerAdapter,

    // CQRS Handlers
    SearchRulesHandler,
    GetRuleHandler,
    ListRulesHandler,
  ],
})
export class AppModule {}
