import { Controller, Get, Post, Res, Req, Logger, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { McpService } from '@infrastructure/adapters/mcp/mcp.service';
import { RouterAgent } from '@agents/router/router.agent';
import { IdentityAgent } from '@agents/identity/identity.agent';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { MessageRole } from '@infrastructure/database/typeorm/entities/chat-message.entity';
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
    const clientId = req.query.clientId as string ||
                     req.headers['x-client-id'] as string ||
                     `ip-${req.ip || 'unknown'}`;

    this.logger.log(`🔌 MCP: New SSE client connected (clientId: ${clientId})`);

    // Configure headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // CHECK IF SESSION ALREADY EXISTS FOR THIS CLIENT
    const existingSessionId = await this.mcpService.findActiveSessionId(clientId);

    if (existingSessionId) {
      this.logger.log(`♻️ MCP: Session already exists: ${existingSessionId} - DO NOT reconnect`);
      // ONLY UPDATE ACTIVITY, DO NOT RECREATE SESSION
      await this.mcpService.touchSession(existingSessionId);

      // Qwen will keep the existing SSE connection
      // Just let the original transport handle messages
      return;
    }

    // Create new MCP session only if it doesn't exist
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
  @ApiOperation({ summary: 'Chat endpoint - Activates agents automatically' })
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
      // Activate RouterAgent to route to specialized agent
      this.agentLogger.info('RouterAgent', '🔄 Activating RouterAgent to process request', {
        inputLength: input.length,
      });

      const response = await this.routerAgent.execute({
        input,
        options: options || {},
      });

      // SAVE RESPONSE TO POSTGRESQL
      if (sessionId && response.data?.message) {
        await this.mcpService.saveChatMessage(
          sessionId,
          MessageRole.ASSISTANT,
          response.data.message,
          {
            agentId: response.data?.metadata?.agentId,
            executionTime: response.metadata?.executionTime,
          },
        ).catch(err => this.logger.warn(`Error saving response: ${err.message}`));
      }

      // Log response
      this.agentLogger.info('MCP-Controller', '✅ Response generated', {
        success: response.success,
        executionTime: response.metadata?.executionTime,
      });

      return {
        success: response.success,
        data: response.data,
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
