import { Controller, Get, Post, Res, Req, Logger, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { McpService } from '@infrastructure/adapters/mcp/mcp.service';
import { RouterAgent } from '@agents/router/router.agent';
import { IdentityAgent } from '@agents/identity/identity.agent';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { MessageRole } from '@modules/sessions/domain/entities/chat-message.entity';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

@ApiTags('MCP')
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly mcpService: McpService,
    private readonly routerAgent: RouterAgent,
    private readonly identityAgent: IdentityAgent,
    private readonly agentLogger: AgentLoggerService,
  ) {}

  @Get('sse')
  @ApiOperation({ summary: 'MCP SSE endpoint for Qwen communication' })
  async sse(@Res() res: Response, @Req() req: Request) {
    // Get unique client identifier (Qwen sends clientId or we use IP)
    // Each Qwen instance should have a unique clientId (timestamp-based)
    const clientId = req.query.clientId as string ||
                     req.headers['x-client-id'] as string ||
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

    this.logger.log(`✅ MCP: Session CREATED: ${sessionId} (clientId: ${clientId})`);

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
  async postMessage(@Res() res: Response, @Req() req: Request, @Body() body: any) {
    // Extraer sessionId del Last-Event-ID header o URL
    const sessionId = req.headers['last-event-id'] as string || req.query.sessionId as string;

    this.logger.log(`📨 MCP: Mensaje recibido (sesión: ${sessionId || 'unknown'})`);

    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    // Obtener la sesión
    const session = this.mcpService.getSession(sessionId);

    if (!session) {
      this.logger.warn(`⚠️ MCP: No hay sesión activa para: ${sessionId}`);
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    try {
      // Procesar el mensaje a través del transporte
      await session.transport.handlePostMessage(req, res, body);
    } catch (error) {
      this.logger.error(`❌ MCP: Error procesando mensaje: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  @Post('chat')
  @ApiOperation({ summary: 'Chat endpoint - Auto-applies rules with Redis+BD persistence' })
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
  async chat(@Body() body: { input: string; options?: Record<string, any>; sessionId?: string }) {
    const { input, options, sessionId } = body;

    if (!input || input.trim().length === 0) {
      return {
        success: false,
        error: 'Input is required',
        logs: this.agentLogger.getRecentLogs(10),
      };
    }

    this.logger.log(`💬 MCP Chat: User says "${input.substring(0, 50)}..."`);

    // SAVE USER MESSAGE TO POSTGRESQL
    if (sessionId) {
      await this.mcpService.saveChatMessage(
        sessionId,
        MessageRole.USER,
        input,
        { options },
      ).catch(err => this.logger.warn(`Error saving message: ${err.message}`));
    }

    // Log start
    this.agentLogger.info('MCP-Controller', '📥 User message received', {
      input: input.substring(0, 100),
      options,
      sessionId,
    });

    try {
      // AUTO-SEARCH RELEVANT RULES FIRST (before routing)
      const relevantRules = await this.searchRelevantRules(input);
      
      this.agentLogger.info('MCP-Controller', '📚 Rules found', {
        count: relevantRules.length,
        rules: relevantRules.map(r => r.name),
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
        rulesContext: this.formatRulesContext(relevantRules) + previousRulesContext,
      };

      // Activate RouterAgent to route to specialized agent WITH RULES CONTEXT
      this.agentLogger.info('RouterAgent', '🔄 Activating RouterAgent with rules context', {
        inputLength: input.length,
        rulesCount: relevantRules.length,
      });

      const response = await this.routerAgent.execute({
        input,
        options: optionsWithRules,
      });

      // SAVE RESPONSE TO POSTGRESQL with rules metadata
      if (sessionId && response.data?.message) {
        await this.mcpService.saveChatMessage(
          sessionId,
          MessageRole.ASSISTANT,
          response.data.message,
          {
            agentId: response.data?.metadata?.agentId,
            executionTime: response.metadata?.executionTime,
            rulesApplied: relevantRules.length,
            rulesIds: relevantRules.map(r => r.id),
          },
        ).catch(err => this.logger.warn(`Error saving response: ${err.message}`));

        // UPDATE SESSION with rules context in BD
        await this.updateSessionWithRulesContext(sessionId, relevantRules);
      }

      // Log response
      this.agentLogger.info('MCP-Controller', '✅ Response generated', {
        success: response.success,
        executionTime: response.metadata?.executionTime,
        rulesApplied: relevantRules.length,
      });

      return {
        success: response.success,
        data: {
          ...response.data,
          relevantRules: relevantRules.length > 0 ? relevantRules : undefined,
          rulesContext: relevantRules.length > 0 ? this.formatRulesContext(relevantRules) : undefined,
        },
        error: response.error,
        metadata: response.metadata,
        logs: this.agentLogger.getRecentLogs(20),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.agentLogger.error('MCP-Controller', `❌ Chat error: ${errorMessage}`, {
        error,
      });

      // SAVE ERROR TO POSTGRESQL
      if (sessionId) {
        await this.mcpService.saveChatMessage(
          sessionId,
          MessageRole.ASSISTANT,
          `Error: ${errorMessage}`,
          { isError: true },
        ).catch(err => this.logger.warn(`Error saving error: ${err.message}`));
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
        this.logger.warn(`Rules API returned non-OK status: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      return data.results?.map((r: any) => r.rule) || [];
    } catch (error) {
      this.logger.error(`Failed to search rules: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Stores rules context in Redis for session continuity
   */
  private async storeRulesContextInRedis(sessionId: string, rules: any[]): Promise<void> {
    try {
      const redisKey = `session:${sessionId}:rulesContext`;
      const rulesData = {
        rules: rules.map(r => ({ id: r.id, name: r.name, category: r.category })),
        timestamp: new Date().toISOString(),
      };
      
      // Store with 1 hour TTL
      await this.mcpService['redisService'].set(redisKey, JSON.stringify(rulesData), 3600);
      this.logger.debug(`💾 Rules context stored in Redis: ${sessionId}`);
    } catch (error) {
      this.logger.warn(`Failed to store rules in Redis: ${error instanceof Error ? error.message : error}`);
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
      
      return `\n\n📋 **Reglas aplicadas en esta sesión:**\n` +
        rules.map((r: any, i: number) => `${i + 1}. ${r.name} (${r.category})`).join('\n');
    } catch (error) {
      this.logger.warn(`Failed to load rules from Redis: ${error instanceof Error ? error.message : error}`);
      return '';
    }
  }

  /**
   * Updates session in BD with rules context
   */
  private async updateSessionWithRulesContext(sessionId: string, rules: any[]): Promise<void> {
    try {
      const session = await this.mcpService['sessionRepository'].findBySessionId(sessionId);
      
      if (!session) return;
      
      // Update session metadata with applied rules
      const updatedMetadata: any = {
        ...session.metadata,
        lastAppliedRules: rules.map(r => r.id),
        rulesAppliedCount: (session.metadata?.rulesAppliedCount || 0) + rules.length,
        lastActivityAt: new Date(),
      };
      
      await this.mcpService['sessionRepository'].getRepository().update(
        { sessionId },
        { metadata: updatedMetadata as any },
      );
      
      this.logger.debug(`📝 Session updated with rules context: ${sessionId}`);
      
      // Also update purpose if exists
      if (session.purposeId) {
        const purpose = await this.mcpService['sessionPurposeRepository'].getRepository().findOne({
          where: { id: session.purposeId },
        });
        
        if (purpose) {
          const updatedPurposeMetadata: any = {
            ...purpose.metadata,
            lastAppliedRules: rules.map(r => r.id),
            appliedRulesSession: sessionId,
            lastUpdatedAt: new Date(),
          };
          
          await this.mcpService['sessionPurposeRepository'].getRepository().update(
            { id: session.purposeId },
            { metadata: updatedPurposeMetadata as any },
          );
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to update session with rules: ${error instanceof Error ? error.message : error}`);
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

  @Get('logs')
  @ApiOperation({ summary: 'Get recent agent logs' })
  getLogs(@Query('count') count?: number) {
    const logs = this.agentLogger.getRecentLogs(count ? parseInt(count.toString(), 10) : 50);
    const stats = this.agentLogger.getAgentStats();

    return {
      logs,
      stats,
      total: logs.length,
    };
  }

  @Get('agents')
  @ApiOperation({ summary: 'List registered agents' })
  getAgents() {
    const agents = this.routerAgent['agentRegistry'].listAgents();
    const stats = this.agentLogger.getAgentStats();

    return {
      agents: agents.map((a) => ({
        id: a.agentId,
        description: a.description,
        logs: stats[a.agentId]?.total || 0,
      })),
      total: agents.length,
    };
  }

  @Get('debug')
  @ApiOperation({ summary: 'Debug MCP sessions and tools' })
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
        ids: agents.map(a => a.agentId),
      },
      tools: [
        { name: 'search_rules', description: 'Busca reglas de código' },
        { name: 'get_rule', description: 'Obtiene regla por ID' },
        { name: 'list_rules', description: 'Lista reglas disponibles' },
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
