import { Controller, Get, Post, Res, Req, Logger, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { McpService } from '@infrastructure/adapters/mcp/mcp.service';
import { RouterAgent } from '@agents/router/router.agent';
import { IdentityAgent } from '@agents/identity/identity.agent';

@ApiTags('MCP')
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly mcpService: McpService,
    private readonly routerAgent: RouterAgent,
    private readonly identityAgent: IdentityAgent,
  ) {}

  @Get('sse')
  @ApiOperation({ summary: 'MCP SSE endpoint for Qwen communication' })
  async sse(@Res() res: Response, @Req() req: Request) {
    this.logger.log(`🔌 MCP: Nuevo cliente SSE conectado`);
    
    // Configurar headers para SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Crear sesión MCP (el transporte genera su propio sessionId)
    const { sessionId } = await this.mcpService.createSession(res);
    
    this.logger.log(`✅ MCP: Sesión creada: ${sessionId}`);

    // Manejar errores
    res.on('error', (error) => {
      this.logger.error(`❌ MCP: Error en SSE: ${error.message}`, error.stack);
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
}
