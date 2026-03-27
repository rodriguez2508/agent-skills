import {
  Controller,
  Get,
  Post,
  Res,
  Req,
  Logger,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { McpService } from '@infrastructure/adapters/mcp/mcp.service';
import { RouterAgent } from '@agents/router/router.agent';
import { IdentityAgent } from '@agents/identity/identity.agent';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { MessageRole } from '@modules/sessions/domain/entities/chat-message.entity';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { RedisService } from '@infrastructure/database/redis/redis.service';

@ApiTags('MCP')
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly mcpService: McpService,
    private readonly routerAgent: RouterAgent,
    private readonly identityAgent: IdentityAgent,
    private readonly agentLogger: AgentLoggerService,
    private readonly redisService: RedisService,
  ) {}

  @Get('sse')
  @ApiOperation({ summary: 'MCP SSE endpoint for Qwen communication' })
  async sse(@Res() res: Response, @Req() req: Request) {
    // Get unique client identifier (Qwen sends clientId or we use IP)
    // Each Qwen instance should have a unique clientId (timestamp-based)
    const clientId =
      (req.query.clientId as string) ||
      (req.headers['x-client-id'] as string) ||
      `ip-${req.ip || 'unknown'}-${Date.now()}`;

    this.logger.log(`🔌 MCP: New SSE client connected (clientId: ${clientId})`);

    // Configure headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // ALWAYS create a new SSE transport for each connection
    // Multiple Qwen instances can connect simultaneously
    // They will share the same userId (by IP) but have different sessionIds
    const { sessionId } = await this.mcpService.createSession(res, clientId);

    this.logger.log(
      `✅ MCP: Session CREATED: ${sessionId} (clientId: ${clientId})`,
    );

    // Handle errors
    res.on('error', (error) => {
      this.logger.error(`❌ MCP: SSE error: ${error.message}`, error.stack);
    });
  }

  @Get('message')
  @ApiOperation({ summary: 'MCP message endpoint (GET for testing)' })
  message(@Res() res: Response) {
    res.json({
      status: 'ok',
      message: '🎓 CodeMentor MCP is ready',
      description: 'POST to this endpoint with MCP messages',
      agents: this.routerAgent['agentRegistry'].getAgentIds(),
      tools: [
        { name: 'search_rules', description: 'Busca reglas de código' },
        { name: 'get_rule', description: 'Obtiene regla por ID' },
        { name: 'list_rules', description: 'Lista reglas disponibles' },
      ],
    });
  }

  @Post('message')
  @ApiOperation({ summary: 'MCP message endpoint (POST for MCP protocol)' })
  async postMessage(
    @Res() res: Response,
    @Req() req: Request,
    @Body() body: any,
  ) {
    const method = body?.method;
    const params = body?.params || {};

    this.logger.log(
      `📨 MCP: Mensaje recibido | method: ${method} | Body: ${JSON.stringify(body)?.substring(0, 300)}`,
    );

    // Delegate to SSE transport for MCP protocol methods
    // The transport handles initialize, tools/list, tools/call, etc. automatically
    const sessionId =
      (req.headers['last-event-id'] as string) ||
      (req.query.sessionId as string);

    // Get the session from McpService
    let session = sessionId ? this.mcpService.getSession(sessionId) : null;

    if (!session) {
      // Try to find by any active session
      const sessions = this.mcpService.getSessions();
      if (sessions.size > 0) {
        session = Array.from(sessions.values())[0];
      }
    }

    if (!session) {
      this.logger.warn(`⚠️ MCP: No hay sesión activa`);
      res.status(404).json({ error: 'No MCP session found' });
      return;
    }

    try {
      // Let the SSE transport handle the message
      // This will handle initialize, tools/list, tools/call, etc. automatically
      await session.transport.handlePostMessage(req, res, body);
      this.logger.log(
        `✅ MCP: Message handled by transport | method: ${method}`,
      );
    } catch (error: any) {
      this.logger.error(`❌ MCP: Error en transport: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Returns the list of MCP tools
   */
  private getMcpTools() {
    return [
      {
        name: 'agent_query',
        description:
          'Consulta principal con agentes especializados. Auto-detecta intención y enruta al agente correcto (PMAgent, CodeAgent, SearchAgent, etc.). Crea issues automáticamente y mantiene historial.',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Tu consulta o petición' },
            sessionId: {
              type: 'string',
              description: 'ID de sesión (opcional)',
            },
            userId: { type: 'string', description: 'ID de usuario (opcional)' },
          },
          required: ['input'],
        },
      },
      {
        name: 'search_rules',
        description: 'Busca reglas de código usando BM25',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Término de búsqueda' },
            category: { type: 'string', description: 'Categoría opcional' },
            limit: {
              type: 'number',
              description: 'Número máximo de resultados',
              default: 5,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_rule',
        description: 'Obtiene una regla específica por ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID de la regla' },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_rules',
        description: 'Lista todas las reglas disponibles',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Filtrar por categoría' },
            limit: {
              type: 'number',
              description: 'Número máximo',
              default: 50,
            },
          },
        },
      },
    ];
  }

  /**
   * Handles tool call execution
   */
  private async handleToolCall(toolName: string, args: any): Promise<string> {
    this.logger.log(
      `🔧 handleToolCall: ${toolName} | args: ${JSON.stringify(args)?.substring(0, 200)}`,
    );

    switch (toolName) {
      case 'agent_query': {
        const input = args?.input;
        const sessionId = args?.sessionId;
        const userId = args?.userId;

        const response = await this.chat({
          input,
          sessionId,
          options: { userId },
        } as any);

        return this.formatAgentResponse(response);
      }

      case 'search_rules': {
        const query = args?.query;
        const category = args?.category;
        const limit = args?.limit || 5;

        const response = await fetch(
          `http://localhost:${process.env.PORT || 8004}/rules/search?q=${encodeURIComponent(query)}${category ? `&category=${category}` : ''}&limit=${limit}`,
        );
        const data = await response.json();
        return this.formatRulesResponse(data);
      }

      case 'get_rule': {
        const id = args?.id;
        const response = await fetch(
          `http://localhost:${process.env.PORT || 8004}/rules?id=${encodeURIComponent(id)}`,
        );
        const data = await response.json();
        return data.rule
          ? `${data.rule.name}\n\n${data.rule.content}`
          : 'Regla no encontrada';
      }

      case 'list_rules': {
        const category = args?.category;
        const limit = args?.limit || 50;
        const response = await fetch(
          `http://localhost:${process.env.PORT || 8004}/rules?${category ? `category=${category}` : ''}&limit=${limit}`,
        );
        const data = await response.json();
        return this.formatListRulesResponse(data);
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Formats agent response for MCP
   */
  private formatAgentResponse(data: any): string {
    if (!data.success) {
      return `⚠️ Error: ${data.error || 'Error desconocido'}`;
    }

    let text = '';
    if (data.data?.message) {
      text += data.data.message + '\n\n';
    }
    if (data.data?.issue) {
      const issue = data.data.issue;
      text += `📋 **Issue**: ${issue.title || issue.issueId || 'N/A'}\n`;
      if (issue.id) text += `ID: ${issue.id}\n`;
    }
    return text.trim();
  }

  /**
   * Formats rules search response
   */
  private formatRulesResponse(data: any): string {
    if (!data.results || data.results.length === 0) {
      return 'No encontré reglas relacionadas con tu búsqueda.';
    }
    let text = `Encontré ${data.results.length} regla(s):\n\n`;
    data.results.forEach((r: any, i: number) => {
      text += `${i + 1}. **${r.rule.name}** (${r.rule.category})\n`;
      text += `${r.rule.content.substring(0, 150)}...\n\n`;
    });
    return text;
  }

  /**
   * Formats list rules response
   */
  private formatListRulesResponse(data: any): string {
    if (!data.rules || data.rules.length === 0) {
      return 'No hay reglas disponibles.';
    }
    let text = `${data.rules.length} regla(s):\n`;
    data.rules.forEach((r: any) => {
      text += `- **${r.name}** (${r.category})\n`;
    });
    return text;
  }

  @Post('chat')
  @ApiOperation({
    summary: 'Chat endpoint - Auto-applies rules with Redis+BD persistence',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'User message' },
        options: { type: 'object', description: 'Additional options' },
        sessionId: { type: 'string', description: 'Session ID (optional)' },
      },
      required: ['input'],
    },
  })
  async chat(
    @Body()
    body: {
      input: string;
      options?: Record<string, any>;
      sessionId?: string;
    },
  ) {
    const { input, options, sessionId } = body;

    if (!input || input.trim().length === 0) {
      return {
        success: false,
        error: 'Input is required',
        logs: this.agentLogger.getRecentLogs(10),
      };
    }

    this.logger.log(
      `💬 MCP Chat: User says "${input.substring(0, 100)}..." | sessionId: ${sessionId} | options: ${JSON.stringify(options)?.substring(0, 100)}`,
    );

    // Log start
    this.agentLogger.info('MCP-Controller', '📥 User message received', {
      input: input.substring(0, 200),
      inputLength: input.length,
      options,
      sessionId,
      hasWorkIntent: this.detectWorkIntent(input),
    });

    // SAVE USER MESSAGE TO POSTGRESQL FIRST
    if (sessionId) {
      await this.mcpService
        .saveChatMessage(sessionId, MessageRole.USER, input, { options })
        .catch((err) =>
          this.logger.warn(`Error saving user message: ${err.message}`),
        );
    }

    try {
      // AUTO-SEARCH RELEVANT RULES FIRST (before routing)
      const relevantRules = await this.searchRelevantRules(input);

      this.agentLogger.info('MCP-Controller', '📚 Rules found', {
        count: relevantRules.length,
        rules: relevantRules.map((r) => r.name),
      });

      // STORE RULES CONTEXT IN REDIS for this session (TTL: 1 hour)
      if (sessionId && relevantRules.length > 0) {
        await this.storeRulesContextInRedis(sessionId, relevantRules);
      }

      // LOAD PREVIOUS RULES CONTEXT from Redis (for conversation continuity)
      const previousRulesContext = sessionId
        ? await this.loadRulesContextFromRedis(sessionId)
        : '';

      // Add rules context to options
      const optionsWithRules = {
        ...options,
        relevantRules,
        rulesContext:
          this.formatRulesContext(relevantRules) + previousRulesContext,
      };

      // AUTO-CREATE ISSUE: Detect work intent and create issue if needed
      const hasWorkIntent = this.detectWorkIntent(input);
      let issueIdForSession: string | null = null;

      if (sessionId && hasWorkIntent) {
        issueIdForSession = await this.getOrCreateIssueForSession(
          sessionId,
          input,
        );
        this.agentLogger.info(
          'MCP-Controller',
          '🔧 Auto-created issue for work session',
          {
            issueId: issueIdForSession,
            workIntent: hasWorkIntent,
            input,
          },
        );
      }

      // Add issueId to options
      const optionsWithIssue = {
        ...optionsWithRules,
        issueId: issueIdForSession,
      };

      // Activate RouterAgent to route to specialized agent WITH RULES CONTEXT
      this.logger.log(
        `🔄 RouterAgent: Activating | input: "${input.substring(0, 80)}..." | rulesCount: ${relevantRules.length} | hasWorkIntent: ${hasWorkIntent} | issueId: ${issueIdForSession} | sessionId: ${sessionId}`,
      );

      this.agentLogger.info(
        'RouterAgent',
        '🔄 Activating RouterAgent with rules context',
        {
          inputLength: input.length,
          rulesCount: relevantRules.length,
          sessionId,
          hasWorkIntent,
          issueId: issueIdForSession,
        },
      );

      const response = await this.routerAgent.execute({
        input,
        options: {
          ...optionsWithIssue,
          sessionId,
          userId: await this.redisService.get(`session:${sessionId}:userId`),
        },
      });

      // SAVE RESPONSE TO POSTGRESQL with rules metadata
      if (sessionId && response.data?.message) {
        await this.mcpService
          .saveChatMessage(
            sessionId,
            MessageRole.ASSISTANT,
            response.data.message,
            {
              agentId: response.data?.metadata?.agentId,
              executionTime: response.metadata?.executionTime,
              rulesApplied: relevantRules.length,
              rulesIds: relevantRules.map((r) => r.id),
            },
          )
          .catch((err) =>
            this.logger.warn(`Error saving response: ${err.message}`),
          );

        // UPDATE SESSION with rules context in BD
        await this.updateSessionWithRulesContext(sessionId, relevantRules);
      }

      // GET ISSUE INFO for response (auto-created or linked)
      const issueInfo = sessionId
        ? await this.getIssueInfoForSession(sessionId)
        : null;

      // Log response
      this.agentLogger.info('MCP-Controller', '✅ Response generated', {
        success: response.success,
        executionTime: response.metadata?.executionTime,
        rulesApplied: relevantRules.length,
        issueId: issueInfo?.id,
      });

      return {
        success: response.success,
        data: {
          ...response.data,
          relevantRules: relevantRules.length > 0 ? relevantRules : undefined,
          rulesContext:
            relevantRules.length > 0
              ? this.formatRulesContext(relevantRules)
              : undefined,
          issue: issueInfo,
        },
        error: response.error,
        metadata: response.metadata,
        logs: this.agentLogger.getRecentLogs(20),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.agentLogger.error(
        'MCP-Controller',
        `❌ Chat error: ${errorMessage}`,
        {
          error,
        },
      );

      // SAVE ERROR TO POSTGRESQL
      if (sessionId) {
        await this.mcpService
          .saveChatMessage(
            sessionId,
            MessageRole.ASSISTANT,
            `Error: ${errorMessage}`,
            { isError: true },
          )
          .catch((err) =>
            this.logger.warn(`Error saving error: ${err.message}`),
          );
      }

      return {
        success: false,
        error: errorMessage,
        logs: this.agentLogger.getRecentLogs(20),
      };
    }
  }

  /**
   * Automatically searches for relevant rules
   */
  private async searchRelevantRules(query: string): Promise<any[]> {
    try {
      const port = process.env.PORT || 8004;
      const url = `http://localhost:${port}/rules/search?q=${encodeURIComponent(query)}&limit=5`;
      const response = await fetch(url);

      if (!response.ok) {
        this.logger.warn(
          `Rules API returned non-OK status: ${response.status}`,
        );
        return [];
      }

      const data = await response.json();
      return data.results?.map((r: any) => r.rule) || [];
    } catch (error) {
      this.logger.error(
        `Failed to search rules: ${error instanceof Error ? error.message : error}`,
      );
      return [];
    }
  }

  /**
   * Stores rules context in Redis for session continuity
   */
  private async storeRulesContextInRedis(
    sessionId: string,
    rules: any[],
  ): Promise<void> {
    try {
      const redisKey = `session:${sessionId}:rulesContext`;
      const rulesData = {
        rules: rules.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
        })),
        timestamp: new Date().toISOString(),
      };

      // Store with 1 hour TTL
      await this.mcpService['redisService'].set(
        redisKey,
        JSON.stringify(rulesData),
        3600,
      );
      this.logger.debug(`💾 Rules context stored in Redis: ${sessionId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to store rules in Redis: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Loads previous rules context from Redis
   */
  private async loadRulesContextFromRedis(sessionId: string): Promise<string> {
    try {
      const redisKey = `session:${sessionId}:rulesContext`;
      const data = await this.mcpService['redisService'].get(redisKey);

      if (!data || typeof data !== 'string') return '';

      const parsed = JSON.parse(data);
      const rules = parsed.rules || [];

      if (rules.length === 0) return '';

      return (
        `\n\n📋 **Reglas aplicadas en esta sesión:**\n` +
        rules
          .map((r: any, i: number) => `${i + 1}. ${r.name} (${r.category})`)
          .join('\n')
      );
    } catch (error) {
      this.logger.warn(
        `Failed to load rules from Redis: ${error instanceof Error ? error.message : error}`,
      );
      return '';
    }
  }

  /**
   * Updates session in BD with rules context
   */
  private async updateSessionWithRulesContext(
    sessionId: string,
    rules: any[],
  ): Promise<void> {
    try {
      const session =
        await this.mcpService['sessionRepository'].findBySessionId(sessionId);

      if (!session) return;

      // Update session metadata with applied rules
      const updatedMetadata: any = {
        ...session.metadata,
        lastAppliedRules: rules.map((r) => r.id),
        rulesAppliedCount:
          (session.metadata?.rulesAppliedCount || 0) + rules.length,
        lastActivityAt: new Date(),
      };

      await this.mcpService['sessionRepository']
        .getRepository()
        .update({ sessionId }, { metadata: updatedMetadata as any });

      this.logger.debug(`📝 Session updated with rules context: ${sessionId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to update session with rules: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Formats rules as context string
   */
  private formatRulesContext(rules: any[]): string {
    if (rules.length === 0) return '';

    let context = '\n\n📋 **Relevant Code Rules (MCP):**\n';
    rules.forEach((rule, i) => {
      context += `\n${i + 1}. **${rule.name}** (${rule.category} - ${rule.impact})\n`;
      context += `   ${rule.content.substring(0, 200)}${rule.content.length > 200 ? '...' : ''}\n`;
    });

    return context;
  }

  /**
   * Gets issue info for a session
   */
  private async getIssueInfoForSession(sessionId: string): Promise<any> {
    try {
      // Check Redis first
      const issueId = await this.mcpService['redisService'].get<string>(
        `session:${sessionId}:issueId`,
      );

      if (!issueId) {
        // Check session in DB
        const session =
          await this.mcpService['sessionRepository'].findBySessionId(sessionId);
        if (!session?.issueId) return null;

        // Use issueRepository directly
        const issue = await this.mcpService['sessionRepository']
          ['getRepository']()
          .manager.getRepository('issues')
          .findOne({ where: { id: session.issueId } });

        if (!issue) {
          return {
            id: session.issueId,
            sessionId,
            autoCreated: true,
          };
        }

        return {
          id: issue.id,
          issueId: issue.issueId || session.issueId,
          title: issue.title,
          status: issue.status,
          sessionId,
          autoCreated: issue.metadata?.autoCreated || false,
        };
      }

      // Get issue from DB using IssueService
      const issue = await this.mcpService['issueService'].getIssueById(issueId);

      if (!issue) return null;

      return {
        id: issue.id,
        issueId: issue.issueId,
        title: issue.title,
        status: issue.status,
        sessionId,
        autoCreated: issue.metadata?.autoCreated || false,
      };
    } catch (error) {
      this.logger.warn(`Error getting issue info: ${error.message}`);
      return null;
    }
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get recent agent logs' })
  getLogs(@Query('count') count?: number) {
    const logs = this.agentLogger.getRecentLogs(
      count ? parseInt(count.toString(), 10) : 50,
    );
    const stats = this.agentLogger.getAgentStats();

    return {
      logs,
      stats,
      total: logs.length,
    };
  }

  @Get('debug')
  @ApiOperation({ summary: 'Debug MCP sessions, tools, and agents' })
  getDebug() {
    const sessions = this.mcpService.getSessions();
    const agents = this.routerAgent['agentRegistry'].listAgents();

    return {
      sessions: {
        count: sessions.size,
        ids: Array.from(sessions.keys()),
      },
      agents: {
        count: agents.length,
        list: agents.map((a) => ({
          id: a.agentId,
          description: a.description,
        })),
        registered: this.routerAgent['agentRegistry'].getAgentIds(),
      },
      tools: [
        { name: 'search_rules', description: 'Busca reglas de código' },
        { name: 'get_rule', description: 'Obtiene regla por ID' },
        { name: 'list_rules', description: 'Lista reglas disponibles' },
        {
          name: 'auto_apply_rules',
          description: 'Auto-aplica reglas a tu consulta',
        },
      ],
      endpoints: {
        chat: 'POST /mcp/chat - Chat with agents (auto-routes to specialist)',
        sse: 'GET /mcp/sse - MCP SSE connection',
        message: 'POST /mcp/message - MCP protocol messages',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('agents')
  @ApiOperation({ summary: 'List all registered agents' })
  getAgents() {
    const agents = this.routerAgent['agentRegistry'].listAgents();
    const stats = this.agentLogger.getAgentStats();

    return {
      total: agents.length,
      agents: agents.map((a) => ({
        id: a.agentId,
        description: a.description,
        logs: stats[a.agentId]?.total || 0,
      })),
      usage: stats,
    };
  }

  /**
   * Detects if the user input indicates work intent (not just a question)
   */
  private detectWorkIntent(input: string): boolean {
    const lowerInput = input.toLowerCase();
    const workPatterns = [
      'quiero',
      'necesito',
      'haz',
      'crear',
      'implementar',
      'agregar',
      'trabajar',
      'desarrollar',
      'build',
      'make',
      'create',
      'add',
      'fix',
      'bug',
      'error',
      'problema',
      'issue',
      'tarea',
      'generar código',
      'escribir',
      'modificar',
      'cambiar',
      'analiza',
      'analisis',
      'analyze',
      'revisar',
      'verificar',
      'revisar código',
      'verificar código',
    ];
    return workPatterns.some((pattern) => lowerInput.includes(pattern));
  }

  /**
   * Gets or creates an issue for the session
   */
  private async getOrCreateIssueForSession(
    sessionId: string,
    input: string,
  ): Promise<string | null> {
    try {
      const existingIssueId = await this.redisService.get<string>(
        `session:${sessionId}:issueId`,
      );
      if (existingIssueId) {
        this.logger.log(
          `🔧 Issue already exists for session: ${sessionId} | issueId: ${existingIssueId}`,
        );
        return existingIssueId;
      }

      const userId = await this.redisService.get<string>(
        `session:${sessionId}:userId`,
      );

      this.logger.log(
        `🔧 getOrCreateIssueForSession | sessionId: ${sessionId} | userId from Redis: ${userId} | input: "${input.substring(0, 80)}..."`,
      );

      if (!userId) {
        this.logger.warn(
          '⚠️ No userId found in Redis for session, cannot create issue | sessionId: ' +
            sessionId,
        );
        return null;
      }

      const title = this.extractTitleFromInput(input);

      this.logger.log(
        `🔧 Creating issue with title: "${title}" | userId: ${userId}`,
      );

      const issueData = await this.mcpService['issueService'].createIssue({
        title,
        description: `Issue created from MCP conversation: ${input.substring(0, 200)}`,
        userId,
        sessionId,
        metadata: {
          autoCreated: true,
          source: 'mcp-auto-detect',
          initialMessage: input,
        },
      });

      await this.redisService.set(
        `session:${sessionId}:issueId`,
        issueData.id,
        86400,
      );

      this.logger.log(
        `✅ Auto-created issue: ${issueData.id} | issueId: ${issueData.issueId} | title: "${title}" | for session: ${sessionId} | userId: ${userId}`,
      );
      return issueData.id;
    } catch (error: any) {
      this.logger.error(
        `❌ Error creating issue: ${error.message} | stack: ${error.stack} | sessionId: ${sessionId}`,
      );
      return null;
    }
  }

  /**
   * Extracts a title from user input
   */
  private extractTitleFromInput(input: string): string {
    const cleaned = input
      .replace(
        /(quiero|necesito|trabajar|en|implementar|agregar|crear|haz|make|build)/gi,
        '',
      )
      .trim();
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
}
