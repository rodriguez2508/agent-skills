import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { Response } from 'express';
import { SessionRepository } from '@modules/sessions/infrastructure/persistence/session.repository';
import { SessionPurposeRepository } from '@infrastructure/persistence/repositories/session-purpose.repository';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { RedisService } from '@infrastructure/database/redis/redis.service';
import { MessageRole } from '@modules/sessions/domain/entities/chat-message.entity';
import { SessionPurpose, SessionPurposeStatus } from '@modules/sessions/domain/entities/session-purpose.entity';
import { SessionStatus } from '@modules/sessions/domain/entities/session.entity';

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
    private readonly sessionPurposeRepository: SessionPurposeRepository,
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
  ) {
    this.apiPort = this.configService.get<number>('PORT', 8004);
  }

  /**
   * Finds an active session by clientId
   * If session exists but has no user_id, it will be updated
   * Also tries to resume session from an active purpose if available
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

          // FIX: If session has no user_id, update it
          if (!session.userId) {
            const ipAddress = clientId.replace('ip-', '');
            const { user } = await this.userRepository.findByIpOrCreate({ ipAddress });

            // Update session with user_id
            await this.sessionRepository.getRepository().update(
              { id: session.id },
              { userId: user.id },
            );

            this.logger.log(`🔧 Fixed session ${cachedSessionId}: Added userId ${user.id}`);
          }

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
        // FIX: If session has no user_id, update it
        if (!matchingSession.userId) {
          const ipAddress = clientId.replace('ip-', '');
          const { user } = await this.userRepository.findByIpOrCreate({ ipAddress });

          await this.sessionRepository.getRepository().update(
            { id: matchingSession.id },
            { userId: user.id },
          );

          this.logger.log(`🔧 Fixed session ${matchingSession.sessionId}: Added userId ${user.id}`);
        }

        // Cache for next time
        await this.redisService.set(`client:${clientId}:sessionId`, matchingSession.sessionId, 3600);
        this.logger.debug(`♻️ Session found in DB: ${matchingSession.sessionId}`);
        return matchingSession.sessionId;
      }

      // TRY TO RESUME FROM ACTIVE PURPOSE
      // If no active session found, try to find an active purpose for this user
      const ipAddress = clientId.replace('ip-', '');
      const { user } = await this.userRepository.findByIpOrCreate({ ipAddress });
      
      if (user?.id) {
        const activePurposes = await this.sessionPurposeRepository.findActiveByUserId(user.id);
        
        if (activePurposes.length > 0) {
          // Find the most recent active purpose
          const latestPurpose = activePurposes[0];
          this.logger.log(`🔄 Found active purpose "${latestPurpose.title}" for user ${user.id}, attempting to resume...`);
          
          // Try to find the last session for this purpose
          if (latestPurpose.lastSessionId) {
            const lastSession = await this.sessionRepository.findBySessionId(latestPurpose.lastSessionId);
            
            if (lastSession) {
              // Reactivate the session if it was expired
              if (lastSession.status === 'expired') {
                await this.sessionRepository.getRepository().update(
                  { id: lastSession.id },
                  { status: SessionStatus.ACTIVE },
                );
                this.logger.log(`✅ Resumed expired session ${lastSession.sessionId} for purpose "${latestPurpose.title}"`);
              } else {
                this.logger.log(`♻️ Found existing session ${lastSession.sessionId} for purpose "${latestPurpose.title}"`);
              }
              
              return lastSession.sessionId;
            }
          }
        }
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
   * Creates session in DB immediately with initial purpose
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
    const transportSessionId = transport.sessionId;
    const session: McpSession = { server, transport };
    this.sessions.set(transportSessionId, session);

    // Extract IP from clientId (format: "ip-::ffff:127.0.0.1-timestamp")
    const ipMatch = clientId?.match(/^ip-(.+?)(-\d+)?$/);
    const ipAddress = ipMatch ? ipMatch[1] : (res.req?.ip || 'unknown');

    // STEP 1: Create or get user by IP
    const { user, isNew } = await this.userRepository.findByIpOrCreate({
      ipAddress,
      email: undefined,
      name: undefined,
    });

    const userId = user.id;
    this.logger.debug(`👤 User ${isNew ? 'created' : 'found'} for IP ${ipAddress}: ${userId}`);

    // STEP 2: Create purpose for this session immediately
    let purposeId: string | undefined;
    try {
      const newPurpose = await this.sessionPurposeRepository.create({
        userId,
        title: `MCP Session - ${clientId || 'New Session'}`,
        description: `User connected from IP ${ipAddress}`,
        metadata: {
          type: 'mcp',
          clientId,
          clientIp: ipAddress,
          createdAt: new Date().toISOString(),
          status: 'connecting',
        },
      });
      purposeId = newPurpose.id;
      this.logger.log(`🎯 Created new purpose: ${newPurpose.title} (ID: ${purposeId})`);
    } catch (error) {
      this.logger.error(`Error creating purpose: ${error.message}`);
    }

    // STEP 3: Create session in PostgreSQL immediately (not just in memory)
    try {
      await this.sessionRepository.create({
        sessionId: transportSessionId,
        userId,
        title: `MCP Session - ${clientId || 'New Session'}`,
        purpose: 'Initial connection',
        purposeId,
        metadata: {
          type: 'mcp',
          clientId,
          clientIp: ipAddress,
          createdAt: new Date().toISOString(),
        },
      });
      this.logger.log(`💾 Session created in PostgreSQL: ${transportSessionId}`);
    } catch (error) {
      this.logger.error(`Error creating session in DB: ${error.message}`);
    }

    // STEP 4: Store user info in Redis for fast lookups
    try {
      await this.redisService.set(`session:${transportSessionId}:userId`, userId, 3600);
      await this.redisService.set(`session:${transportSessionId}:clientId`, clientId || '', 3600);
      await this.redisService.set(`session:${transportSessionId}:ip`, ipAddress, 3600);
      await this.redisService.set(`session:${transportSessionId}:purposeId`, purposeId || '', 3600);
      this.logger.debug(`💾 Session metadata stored in Redis: ${transportSessionId}`);
    } catch (error) {
      this.logger.error(`Error storing session metadata in Redis: ${error.message}`);
    }

    // Store clientId -> sessionId in Redis for fast lookups (short TTL, 1 hour)
    if (clientId) {
      await this.redisService.set(`client:${clientId}:sessionId`, transportSessionId, 3600);
    }

    this.logger.log(`✅ MCP: Session created (runtime + PostgreSQL): ${transportSessionId}`);

    // Cleanup when connection closes
    res.on('close', () => {
      this.closeSession(transportSessionId);
    });

    return { sessionId: transportSessionId, session };
  }

  /**
   * Creates or gets session for a user when first tool is called
   * Now session is created immediately on connection, this just updates the purpose
   */
  async getOrCreateSessionForToolUse(
    sessionId: string,
    userId: string,
    toolName: string,
    clientId?: string,
    ipAddress?: string,
  ): Promise<string> {
    // Check if session already exists in DB
    const existingDbSession = await this.sessionRepository.findBySessionId(sessionId);

    if (existingDbSession) {
      // Update purpose if needed
      if (existingDbSession.purposeId) {
        await this.sessionPurposeRepository.updateLastSession(existingDbSession.purposeId, sessionId);
      }
      this.logger.debug(`♻️ Session already exists in DB: ${sessionId}`);
      return existingDbSession.sessionId;
    }

    // Fallback: Create session if it doesn't exist (shouldn't happen normally)
    this.logger.warn(`⚠️ Session not found, creating on-the-fly: ${sessionId}`);
    return sessionId;
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
   * Creates session if it doesn't exist (for conversations)
   */
  async saveChatMessage(sessionId: string, role: MessageRole, content: string, metadata?: any): Promise<void> {
    try {
      // Get user info from Redis
      const userId = await this.redisService.get<string>(`session:${sessionId}:userId`);
      const clientId = await this.redisService.get<string>(`session:${sessionId}:clientId`);
      const ipAddress = await this.redisService.get<string>(`session:${sessionId}:ip`);

      // Create session if it doesn't exist (first message)
      if (userId) {
        const createdSessionId = await this.getOrCreateSessionForToolUse(
          sessionId,
          userId,
          'conversation',
          clientId || undefined,
          ipAddress || undefined,
        );

        // Update purpose's lastSessionId
        const session = await this.sessionRepository.findBySessionId(createdSessionId);
        if (session?.purposeId) {
          await this.sessionPurposeRepository.updateLastSession(session.purposeId, createdSessionId);
        }
      }

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

    // auto_apply_rules - Automatically searches and applies relevant rules to user queries
    server.tool(
      'auto_apply_rules',
      'Automatically searches and applies relevant code rules to the user query. This tool should be called on every user message to provide context-aware responses.',
      {
        userQuery: z.string().describe('The user\'s question or request'),
        sessionId: z.string().optional().describe('Session ID for tracking'),
      },
      async ({ userQuery, sessionId }, extra) => {
        const currentSessionId = sessionId || extra?.sessionId || 'unknown';
        
        this.logger.log(`🤖 MCP: auto_apply_rules triggered - query="${userQuery.substring(0, 100)}..."`);
        
        try {
          // Search for relevant rules
          const url = `http://localhost:${this.apiPort}/rules/search?q=${encodeURIComponent(userQuery)}&limit=5`;
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            this.logger.log(`✅ MCP: Found ${data.results.length} relevant rules`);
            const text = this.formatResponse('search', data);
            return { content: [{ type: 'text' as const, text }] };
          } else {
            this.logger.debug('ℹ️ MCP: No relevant rules found');
            return { content: [{ type: 'text' as const, text: '🎓 **Según CodeMentor MCP**: No se encontraron reglas relevantes para esta consulta.' }] };
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: auto_apply_rules failed - ${msg}`);
          return { content: [{ type: 'text' as const, text: `⚠️ 🎓 According to CodeMentor MCP: ${msg}` }], isError: true };
        }
      },
    );

    // search_rules
    server.tool(
      'search_rules',
      'Searches code rules using BM25. Returns rules with prefix "🎓 According to CodeMentor MCP"',
      {
        query: z.string().describe('Search term'),
        category: z.string().optional().describe('Category (nestjs, angular, typescript)'),
        limit: z.number().default(5).describe('Maximum number of results'),
      },
      async ({ query, category, limit }, extra) => {
        // Get session info from request context
        const sessionId = extra?.sessionId || 'unknown';

        // Get user info from Redis (stored during session creation)
        const userId = await this.redisService.get<string>(`session:${sessionId}:userId`);
        const ipAddress = await this.redisService.get<string>(`session:${sessionId}:ip`);

        // Create session in DB on first tool use (meaningful interaction)
        if (userId) {
          await this.getOrCreateSessionForToolUse(
            sessionId,
            userId,
            'search_rules',
            ipAddress ? `ip-${ipAddress}` : undefined,
            ipAddress || undefined,
          );
        }

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
      async ({ id }, extra) => {
        const sessionId = extra?.sessionId || 'unknown';
        const userId = await this.redisService.get<string>(`session:${sessionId}:userId`);
        const ipAddress = await this.redisService.get<string>(`session:${sessionId}:ip`);

        // Create session in DB on first tool use
        if (userId) {
          await this.getOrCreateSessionForToolUse(
            sessionId, 
            userId, 
            'get_rule', 
            ipAddress ? `ip-${ipAddress}` : undefined, 
            ipAddress || undefined,
          );
        }

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
      async ({ category, limit }, extra) => {
        const sessionId = extra?.sessionId || 'unknown';
        const userId = await this.redisService.get<string>(`session:${sessionId}:userId`);
        const ipAddress = await this.redisService.get<string>(`session:${sessionId}:ip`);

        // Create session in DB on first tool use
        if (userId) {
          await this.getOrCreateSessionForToolUse(
            sessionId, 
            userId, 
            'list_rules', 
            ipAddress ? `ip-${ipAddress}` : undefined, 
            ipAddress || undefined,
          );
        }

        this.logger.log(`📋 MCP: list_rules llamado - category=${category}, limit=${limit}`);
        try {
          const params = new URLSearchParams();
          if (category) params.set('category', category);
          params.set('limit', String(limit || 50));
          
          const url = `http://localhost:${this.apiPort}/rules?${params.toString()}`;
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
        response += `**Categoría:** ${r.rule.category} | **Impacto:** ${r.rule.impact}${r.rule.impactDescription ? ` (${r.rule.impactDescription})` : ''} | **Relevancia:** ${(r.score * 100).toFixed(1)}%\n`;
        response += `**Tags:** ${r.rule.tags?.join(', ') || 'N/A'}\n\n`;
        response += `${r.rule.content.substring(0, 400)}${r.rule.content.length > 400 ? '...' : ''}\n\n---\n\n`;
      });
      return response.trim();
    }

    if (type === 'get') {
      if (!data.rule) return `${prefix}: No encontré regla con ese ID.`;
      let response = `${prefix}:\n\n# ${data.rule.name}\n\n`;
      if (data.rule.impactDescription) {
        response += `**Impacto:** ${data.rule.impact} - ${data.rule.impactDescription}\n\n`;
      }
      response += data.rule.content;
      return response;
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
          const impactInfo = r.impactDescription ? ` - ${r.impact}` : '';
          response += `${i + 1}. **${r.name}** (\`${r.id}\`)${impactInfo}\n`;
        });
        response += '\n';
      }
      return response.trim();
    }

    return `${prefix}: ${JSON.stringify(data, null, 2)}`;
  }
}
