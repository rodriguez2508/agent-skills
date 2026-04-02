import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Infrastructure
import { BM25Engine } from '@infrastructure/search/bm25/bm25.engine';
import { RuleFileRepository } from '@infrastructure/persistence/repositories/rule-file.repository';
import { GrpcServerAdapter } from '@infrastructure/adapters/grpc/grpc-server.adapter';
import { McpService } from '@infrastructure/adapters/mcp/mcp.service';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { RulesEngine } from '@infrastructure/rules/rules-engine';
import { VectorStorageModule } from '@infrastructure/vector-storage/vector-storage.module';
import { DatabaseModule } from '@infrastructure/database/database.module';

// Presentation
import { HealthController } from '@presentation/controllers/health/health.controller';
import { RulesController } from '@presentation/controllers/rules/rules.controller';
import { McpController } from '@presentation/controllers/mcp/mcp.controller';
import { AgentsController } from '@presentation/controllers/agents/agents.controller';

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
import { PMAgent } from '@agents/pm/pm.agent';
import { IssueWorkflowAgent } from '@agents/workflow/issue-workflow.agent';
import { GitHubAgent } from '@agents/github/github.agent';
import { FrontendArchitectureAgent } from '@agents/frontend-architecture/frontend-architecture.agent';
import { FrontendArchitectureModule } from '@agents/frontend-architecture/frontend-architecture.module';
import { WebSearchAgent } from '@agents/web-search/web-search.agent';
import { WebSearchModule } from '@agents/web-search/web-search.module';
import { SearchModule } from '@infrastructure/adapters/search/search.module';

// Domain
import { RULE_REPOSITORY } from '@core/domain/ports/rule-repository.token';

// New Modular Structure
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { SessionsModule } from '@modules/sessions/sessions.module';
import { IssuesModule } from '@modules/issues/issues.module';
import { ProjectsModule } from '@modules/projects/projects.module';
import { ContextsModule } from '@modules/contexts/contexts.module';
import { AuthController } from '@modules/auth/presentation/controllers/auth.controller';

// Middleware
import { IpTrackerMiddleware } from '@shared/middleware/ip-tracker.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CqrsModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    VectorStorageModule.forRoot({
      type: 'inmemory', // Default for development, change to 'chromadb' for production
      global: true,
    }),
    SearchModule,

    // New Modular Structure
    AuthModule,
    UsersModule,
    SessionsModule,
    IssuesModule,
    ProjectsModule,
    ContextsModule,
    FrontendArchitectureModule,
    WebSearchModule,
  ],
  controllers: [
    HealthController,
    RulesController,
    McpController,
    AuthController,
    AgentsController,
  ],
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

    // Specialized Agents (10 agentes)
    SearchAgent,
    IdentityAgent,
    RulesAgent,
    CodeAgent,
    ArchitectureAgent,
    AnalysisAgent,
    MetricsAgent,
    PMAgent,
    IssueWorkflowAgent,
    GitHubAgent,
    FrontendArchitectureAgent,
    WebSearchAgent,

    // CQRS Handlers
    SearchRulesHandler,
    GetRuleHandler,
    ListRulesHandler,

    // Middleware
    IpTrackerMiddleware,
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
    private readonly pmAgent: PMAgent,
    private readonly issueWorkflowAgent: IssueWorkflowAgent,
    private readonly gitHubAgent: GitHubAgent,
    private readonly frontendArchitectureAgent: FrontendArchitectureAgent,
    private readonly webSearchAgent: WebSearchAgent,
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
    this.agentRegistry.register(this.pmAgent);
    this.agentRegistry.register(this.issueWorkflowAgent);
    this.agentRegistry.register(this.gitHubAgent);
    this.agentRegistry.register(this.frontendArchitectureAgent);
    this.agentRegistry.register(this.webSearchAgent);

    // Register agents in the router
    this.routerAgent.registerAllAgents();

    console.log('✅ Multi-Agent System initialized');
    console.log(`📊 Registered agents: ${this.agentRegistry.count()}`);
    console.log(`📋 Agents: ${this.agentRegistry.getAgentIds().join(', ')}`);
    console.log(`📚 Loaded rules: ${this.rulesEngine.getAllRules().length}`);
  }
}
