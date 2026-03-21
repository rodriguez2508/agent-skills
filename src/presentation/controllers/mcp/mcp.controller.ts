import { Controller, Get, Res, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('MCP')
@Controller('mcp')
export class McpController {
  @Get('sse')
  @ApiOperation({ summary: 'MCP SSE endpoint for Qwen communication' })
  sse(@Res() res: Response) {
    // Configurar headers para SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Enviar evento inicial
    res.write(`event: endpoint\ndata: http://localhost:8004/mcp/message\n\n`);

    // Mantener conexión viva
    const interval = setInterval(() => {
      res.write(': ping\n\n');
    }, 30000);

    // Limpiar cuando el cliente se desconecte
    res.on('close', () => {
      clearInterval(interval);
    });
  }

  @Get('message')
  @ApiOperation({ summary: 'MCP message endpoint' })
  message(@Res() res: Response) {
    res.json({
      status: 'ok',
      message: '🎓 CodeMentor MCP is ready',
      tools: [
        { name: 'search_rules', description: 'Busca reglas de código' },
        { name: 'get_rule', description: 'Obtiene regla por ID' },
        { name: 'list_rules', description: 'Lista reglas disponibles' },
      ],
    });
  }
}
