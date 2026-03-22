import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { Response } from 'express';
import { SessionRepository } from '@infrastructure/persistence/repositories/session.repository';
import { RedisService } from '@infrastructure/database/redis/redis.service';
import { MessageRole } from '@infrastructure/database/typeorm/entities/chat-message.entity';

export interface McpSession {
  server: McpServer;
  transport: SSEServerTransport;
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private readonly apiPort: number;

  // Stores active sessions by sessionId (MCP runtime)
  private sessions: Map<string, McpSession> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionRepository: SessionRepository,
    private readonly redisService: RedisService,
  ) {
    this.apiPort = this.configService.get<number>('PORT', 8004);
  }

  /**
   * Finds an active session by clientId
   */
  async findActiveSessionId(clientId: string): Promise<string | null> {
    try {
      // Try Redis first (faster)
      const cachedSessionId = await this.redisService.get<string>(`client:${clientId}:sessionId`);
      if (cachedSessionId) {
        // Check if session exists in PostgreSQL
        const session = await this.sessionRepository.findBySessionId(cachedSessionId);
        if (session && session.status === 'active') {
          this.logger.debug(`♻️ Session found in cache: ${cachedSessionId}`);
          return cachedSessionId;
        }
      }

      // Search in PostgreSQL
      const sessions = await this.sessionRepository.getActiveSessions();
      const matchingSession = sessions.find(s => 
        s.metadata?.clientId === clientId || 
        s.metadata?.clientIp === clientId.replace('ip-', '')
      );

      if (matchingSession) {
        // Cache for next time
        await this.redisService.set(`client:${clientId}:sessionId`, matchingSession.sessionId, 3600);
        this.logger.debug(`♻️ Session found in DB: ${matchingSession.sessionId}`);
        return matchingSession.sessionId;
      }
    } catch (error) {
      this.logger.error(`Error finding session: ${error.message}`);
    }

    return null;
  }

  /**
   * Updates lastActivityAt for a session
   */
  async touchSession(sessionId: string): Promise<void> {
    try {
      const session = await this.sessionRepository.findBySessionId(sessionId);
      if (session) {
        await this.sessionRepository.getRepository().update(
          { id: session.id },
          { lastActivityAt: new Date() },
        );
        this.logger.debug(`🕒 Session activity updated: ${sessionId}`);
      }
    } catch (error) {
      this.logger.error(`Error updating activity: ${error.message}`);
    }
  }

  /**
   * Creates a new MCP session with its transport
   */
  async createSession(res: Response, clientId?: string): Promise<{ sessionId: string; session: McpSession }> {
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

    // Connect server to transport
    await server.connect(transport);

    // Transport generates its own sessionId
    const sessionId = transport.sessionId;
    const session: McpSession = { server, transport };
    this.sessions.set(sessionId, session);

    // SAVE TO POSTGRESQL
    try {
      const createdSession = await this.sessionRepository.create({
        sessionId,
        title: 'MCP Session',
        metadata: {
          type: 'mcp',
          clientId,
          clientIp: res.req?.ip,
          createdAt: new Date().toISOString(),
        },
      });
      
      // Store clientId -> sessionId in Redis for fast lookups
      if (clientId) {
        await this.redisService.set(`client:${clientId}:sessionId`, sessionId, 86400);
      }
      
      this.logger.debug(`💾 Session saved to PostgreSQL: ${sessionId} (clientId: ${clientId})`);
    } catch (error) {
      this.logger.error(`Error saving session to DB: ${error.message}`);
    }

    // SAVE TO REDIS
    try {
      await this.redisService.setSession(sessionId, {
        type: 'mcp',
        clientId,
        createdAt: Date.now(),
      }, 86400);
      this.logger.debug(`💾 Session saved to Redis: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error saving session to Redis: ${error.message}`);
    }

    this.logger.log(`✅ MCP: Session created: ${sessionId}`);

    // Cleanup when connection closes
    res.on('close', () => {
      this.closeSession(sessionId);
    });

    return { sessionId, session };
  }

  /**
   * Closes and removes a session
   */
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.logger.log(`🗑️ MCP: Session closed: ${sessionId}`);
    }
  }

  /**
   * Gets a session by ID
   */
  getSession(sessionId: string): McpSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Gets all sessions (for debug)
   */
  getSessions(): Map<string, McpSession> {
    return this.sessions;
  }

  /**
   * Saves a chat message to PostgreSQL
   */
  async saveChatMessage(sessionId: string, role: MessageRole, content: string, metadata?: any): Promise<void> {
    try {
      await this.sessionRepository.addMessage({
        sessionId,
        role,
        content,
        metadata,
        tokenCount: content.length,
      });
      this.logger.debug(`💬 Message saved to PostgreSQL: ${sessionId} - ${role}`);
    } catch (error) {
      this.logger.error(`Error saving message to DB: ${error.message}`);
    }
  }

  private registerTools(server: McpServer) {
    this.logger.log('🔧 MCP: Registering tools...');

    // search_rules
    server.tool(
      'search_rules',
      'Searches code rules using BM25. Returns rules with prefix "🎓 According to CodeMentor MCP"',
      {
        query: z.string().describe('Search term'),
        category: z.string().optional().describe('Category (nestjs, angular, typescript)'),
        limit: z.number().default(5).describe('Maximum number of results'),
      },
      async ({ query, category, limit }) => {
        this.logger.log(`🔍 MCP: search_rules called - query="${query}", category=${category}, limit=${limit}`);
        try {
          const url = `http://localhost:${this.apiPort}/rules/search?q=${encodeURIComponent(query)}${
            category ? `&category=${category}` : ''
          }&limit=${limit || 5}`;
          const response = await fetch(url);
          const data = await response.json();
          const text = this.formatResponse('search', data);
          this.logger.log(`✅ MCP: search_rules completed - ${data.results?.length || 0} results`);
          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: search_rules failed - ${msg}`);
          return { content: [{ type: 'text' as const, text: `⚠️ 🎓 According to CodeMentor MCP: ${msg}` }], isError: true };
        }
      },
    );

    // get_rule
    server.tool(
      'get_rule',
      'Gets a rule by ID. Returns with prefix "🎓 According to CodeMentor MCP"',
      {
        id: z.string().describe('Rule ID'),
      },
      async ({ id }) => {
        this.logger.log(`📖 MCP: get_rule called - id=${id}`);
        try {
          const response = await fetch(`http://localhost:${this.apiPort}/rules?id=${encodeURIComponent(id)}`);
          const data = await response.json();
          const text = this.formatResponse('get', data);
          this.logger.log(`✅ MCP: get_rule completed`);
          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: get_rule failed - ${msg}`);
          return { content: [{ type: 'text' as const, text: `⚠️ 🎓 According to CodeMentor MCP: ${msg}` }], isError: true };
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
        this.logger.log(`📋 MCP: list_rules llamado - category=${category}, limit=${limit}`);
        try {
          const url = `http://localhost:${this.apiPort}/rules${
            category ? `?category=${category}` : ''
          }&limit=${limit || 50}`;
          const response = await fetch(url);
          const data = await response.json();
          const text = this.formatResponse('list', data);
          this.logger.log(`✅ MCP: list_rules completado - ${data.rules?.length || 0} reglas`);
          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: list_rules falló - ${msg}`);
          return { content: [{ type: 'text' as const, text: `⚠️ 🎓 Según CodeMentor MCP: ${msg}` }], isError: true };
        }
      },
    );

    this.logger.log('✅ MCP: Todas las herramientas registradas');
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
