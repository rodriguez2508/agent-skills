import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { Response } from 'express';

export interface McpSession {
  server: McpServer;
  transport: SSEServerTransport;
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private readonly apiPort: number;

  // Almacena sesiones activas por sessionId
  private sessions: Map<string, McpSession> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.apiPort = this.configService.get<number>('PORT', 8004);
  }

  /**
   * Crea una nueva sesión MCP con su transporte
   */
  async createSession(res: Response): Promise<{ sessionId: string; session: McpSession }> {
    const transport = new SSEServerTransport('/mcp/message', res);
    
    const server = new McpServer(
      {
        name: 'CodeMentor MCP',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.registerTools(server);

    // Conectar servidor al transporte
    await server.connect(transport);

    // El transporte genera su propio sessionId
    const sessionId = transport.sessionId;
    const session: McpSession = { server, transport };
    this.sessions.set(sessionId, session);
    
    this.logger.log(`✅ MCP: Sesión creada: ${sessionId}`);

    // Limpiar cuando se cierre la conexión
    res.on('close', () => {
      this.closeSession(sessionId);
    });

    return { sessionId, session };
  }

  /**
   * Cierra y elimina una sesión
   */
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.logger.log(`🗑️ MCP: Sesión cerrada: ${sessionId}`);
    }
  }

  /**
   * Obtiene una sesión por ID
   */
  getSession(sessionId: string): McpSession | undefined {
    return this.sessions.get(sessionId);
  }

  private registerTools(server: McpServer) {
    // search_rules
    server.tool(
      'search_rules',
      'Busca reglas de código usando BM25. Devuelve reglas con el prefijo "🎓 Según CodeMentor MCP"',
      {
        query: z.string().describe('Término de búsqueda'),
        category: z.string().optional().describe('Categoría (nestjs, angular, typescript)'),
        limit: z.number().default(5).describe('Número máximo de resultados'),
      },
      async ({ query, category, limit }) => {
        try {
          const url = `http://localhost:${this.apiPort}/rules/search?q=${encodeURIComponent(query)}${
            category ? `&category=${category}` : ''
          }&limit=${limit || 5}`;
          const response = await fetch(url);
          const data = await response.json();
          const text = this.formatResponse('search', data);
          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          return { content: [{ type: 'text' as const, text: `⚠️ 🎓 Según CodeMentor MCP: ${msg}` }], isError: true };
        }
      },
    );

    // get_rule
    server.tool(
      'get_rule',
      'Obtiene regla por ID. Devuelve con prefijo "🎓 Según CodeMentor MCP"',
      {
        id: z.string().describe('ID de la regla'),
      },
      async ({ id }) => {
        try {
          const response = await fetch(`http://localhost:${this.apiPort}/rules?id=${encodeURIComponent(id)}`);
          const data = await response.json();
          const text = this.formatResponse('get', data);
          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          return { content: [{ type: 'text' as const, text: `⚠️ 🎓 Según CodeMentor MCP: ${msg}` }], isError: true };
        }
      },
    );

    // list_rules
    server.tool(
      'list_rules',
      'Lista reglas disponibles. Devuelve con prefijo "🎓 Según CodeMentor MCP"',
      {
        category: z.string().optional().describe('Filtrar por categoría'),
        limit: z.number().default(50).describe('Número máximo'),
      },
      async ({ category, limit }) => {
        try {
          const url = `http://localhost:${this.apiPort}/rules${
            category ? `?category=${category}` : ''
          }&limit=${limit || 50}`;
          const response = await fetch(url);
          const data = await response.json();
          const text = this.formatResponse('list', data);
          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          return { content: [{ type: 'text' as const, text: `⚠️ 🎓 Según CodeMentor MCP: ${msg}` }], isError: true };
        }
      },
    );

    this.logger.log('🎓 CodeMentor MCP: Herramientas registradas');
  }

  private formatResponse(type: 'search' | 'get' | 'list', data: any): string {
    const prefix = '🎓 **Según CodeMentor MCP**';

    if (type === 'search') {
      if (!data.results || data.results.length === 0) {
        return `${prefix}: No encontré reglas relacionadas con tu búsqueda.`;
      }
      let response = `${prefix}: Encontré ${data.results.length} regla(s):\n\n`;
      data.results.forEach((r: any, i: number) => {
        response += `### ${i + 1}. ${r.rule.name}\n`;
        response += `**Categoría:** ${r.rule.category} | **Relevancia:** ${(r.score * 100).toFixed(1)}%\n`;
        response += `**Tags:** ${r.rule.tags?.join(', ') || 'N/A'}\n\n`;
        response += `${r.rule.content.substring(0, 400)}${r.rule.content.length > 400 ? '...' : ''}\n\n---\n\n`;
      });
      return response.trim();
    }

    if (type === 'get') {
      if (!data.rule) return `${prefix}: No encontré regla con ese ID.`;
      return `${prefix}:\n\n# ${data.rule.name}\n\n${data.rule.content}`;
    }

    if (type === 'list') {
      if (!data.rules || data.rules.length === 0) {
        return `${prefix}: No hay reglas disponibles.`;
      }
      let response = `${prefix}: ${data.rules.length} regla(s) disponible(s):\n\n`;
      const grouped = data.rules.reduce((acc: any, r: any) => {
        if (!acc[r.category]) acc[r.category] = [];
        acc[r.category].push(r);
        return acc;
      }, {});
      for (const [cat, rules] of Object.entries(grouped)) {
        response += `## 📁 ${cat.toUpperCase()}\n`;
        (rules as any[]).forEach((r, i) => {
          response += `${i + 1}. **${r.name}** (\`${r.id}\`)\n`;
        });
        response += '\n';
      }
      return response.trim();
    }

    return `${prefix}: ${JSON.stringify(data, null, 2)}`;
  }
}
