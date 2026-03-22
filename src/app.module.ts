import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

// Infrastructure
import { BM25Engine } from '@infrastructure/search/bm25/bm25.engine';
import { RuleFileRepository } from '@infrastructure/persistence/repositories/rule-file.repository';
import { GrpcServerAdapter } from '@infrastructure/adapters/grpc/grpc-server.adapter';
import { McpService } from '@infrastructure/adapters/mcp/mcp.service';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { RulesEngine } from '@infrastructure/rules/rules-engine';
import { VectorStorageModule } from '@infrastructure/vector-storage/vector-storage.module';

// Presentation
import { HealthController } from '@presentation/controllers/health/health.controller';
import { RulesController } from '@presentation/controllers/rules/rules.controller';
import { McpController } from '@presentation/controllers/mcp/mcp.controller';

// Application Handlers (CQRS)
import { SearchRulesHandler } from '@application/queries/search-rules/search-rules.handler';
import { GetRuleHandler } from '@application/queries/get-rule/get-rule.handler';
import { ListRulesHandler } from '@application/queries/list-rules/list-rules.handler';

// Agents
import { AgentRegistry } from '@core/agents/agent-registry';
import { RouterAgent } from '@agents/router/router.agent';
import { SearchAgent } from '@agents/search/search.agent';
import { IdentityAgent } from '@agents/identity/identity.agent';
import { RulesAgent } from '@agents/rules/rules.agent';
import { CodeAgent } from '@agents/code/code.agent';
import { ArchitectureAgent } from '@agents/architecture/architecture.agent';
import { AnalysisAgent } from '@agents/analysis/analysis.agent';
import { MetricsAgent } from '@agents/metrics/metrics.agent';

// Domain
import { RULE_REPOSITORY } from '@core/domain/ports/rule-repository.token';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CqrsModule,
    VectorStorageModule.forRoot({
      type: 'inmemory', // Default for development, change to 'chromadb' for production
      global: true,
    }),
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
    McpService,
    AgentLoggerService,
    RulesEngine,

    // Agents Core
    AgentRegistry,
    RouterAgent,

    // Specialized Agents (8 agentes)
    SearchAgent,
    IdentityAgent,
    RulesAgent,
    CodeAgent,
    ArchitectureAgent,
    AnalysisAgent,
    MetricsAgent,

    // CQRS Handlers
    SearchRulesHandler,
    GetRuleHandler,
    ListRulesHandler,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly routerAgent: RouterAgent,
    private readonly searchAgent: SearchAgent,
    private readonly identityAgent: IdentityAgent,
    private readonly rulesAgent: RulesAgent,
    private readonly codeAgent: CodeAgent,
    private readonly architectureAgent: ArchitectureAgent,
    private readonly analysisAgent: AnalysisAgent,
    private readonly metricsAgent: MetricsAgent,
    private readonly rulesEngine: RulesEngine,
  ) {}

  async onModuleInit() {
    // Initialize RulesEngine first
    await this.rulesEngine.onModuleInit();

    // Register all agents in the registry
    this.agentRegistry.register(this.searchAgent);
    this.agentRegistry.register(this.identityAgent);
    this.agentRegistry.register(this.rulesAgent);
    this.agentRegistry.register(this.codeAgent);
    this.agentRegistry.register(this.architectureAgent);
    this.agentRegistry.register(this.analysisAgent);
    this.agentRegistry.register(this.metricsAgent);

    // Register agents in the router
    this.routerAgent.registerAllAgents();

    console.log('✅ Multi-Agent System initialized');
    console.log(`📊 Registered agents: ${this.agentRegistry.count()}`);
    console.log(`📋 Agents: ${this.agentRegistry.getAgentIds().join(', ')}`);
    console.log(`📚 Loaded rules: ${this.rulesEngine.getAllRules().length}`);
  }
}
