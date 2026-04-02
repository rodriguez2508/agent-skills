import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Express } from 'express';
import express from 'express';
import { z } from 'zod';

const PORT = process.env.PORT || 8004;
const API_URL = `http://localhost:${PORT}`;

// Crear servidor MCP
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

// ============================================================================
// PRINCIPAL HERRAMIENTA: agent_query - Usa el sistema completo de agentes
// ============================================================================
server.tool(
  'agent_query',
  'Consulta principal con agentes especializados. Auto-detecta intención y enruta al agente correcto (PMAgent, CodeAgent, SearchAgent, etc.). Crea issues automáticamente y mantiene historial.',
  {
    input: z.string().describe('Tu consulta o petición'),
    sessionId: z
      .string()
      .optional()
      .describe('ID de sesión para mantener historial (opcional)'),
    userId: z.string().optional().describe('ID de usuario (opcional)'),
  },
  async ({ input, sessionId, userId }) => {
    try {
      // Generate sessionId if not provided (for session continuity)
      const session = sessionId || `session-${Date.now()}`;

      const url = `${API_URL}/mcp/chat`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          sessionId: session,
          options: { userId },
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      // Format response with agent routing info
      let text = '';

      if (data.success) {
        text = formatAgentResponse(data);
      } else {
        text = `⚠️ **Error**: ${data.error || 'Error desconocido'}\n\n${data.logs ? `Logs:\n${JSON.stringify(data.logs, null, 2)}` : ''}`;
      }

      return {
        content: [{ type: 'text' as const, text }],
        isError: !data.success,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error';
      return {
        content: [
          { type: 'text' as const, text: `⚠️ 🎓 Según CodeMentor MCP: ${msg}` },
        ],
        isError: true,
      };
    }
  },
);

// ============================================================================
// HERRAMIENTAS LEGACY: Búsqueda directa de reglas (para compatibilidad)
// ============================================================================

// Registrar herramienta: search_rules
server.tool(
  'search_rules',
  'Busca reglas de código usando BM25. Devuelve reglas con el prefijo "🎓 Según CodeMentor MCP"',
  {
    query: z.string().describe('Término de búsqueda'),
    category: z
      .string()
      .optional()
      .describe('Categoría opcional (nestjs, angular, typescript)'),
    limit: z.number().default(5).describe('Número máximo de resultados'),
  },
  async ({ query, category, limit }) => {
    try {
      const url = `http://localhost:${PORT}/rules/search?q=${encodeURIComponent(query)}${
        category ? `&category=${category}` : ''
      }&limit=${limit || 5}`;

      const response = await fetch(url);
      const data = await response.json();

      const text = formatCodeMentorResponse('search', data);
      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error';
      return {
        content: [
          { type: 'text' as const, text: `⚠️ 🎓 Según CodeMentor MCP: ${msg}` },
        ],
        isError: true,
      };
    }
  },
);

// Registrar herramienta: get_rule
server.tool(
  'get_rule',
  'Obtiene una regla específica por ID. Devuelve con prefijo "🎓 Según CodeMentor MCP"',
  {
    id: z.string().describe('ID de la regla'),
  },
  async ({ id }) => {
    try {
      const response = await fetch(
        `http://localhost:${PORT}/rules?id=${encodeURIComponent(id)}`,
      );
      const data = await response.json();
      const text = formatCodeMentorResponse('get', data);
      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error';
      return {
        content: [
          { type: 'text' as const, text: `⚠️ 🎓 Según CodeMentor MCP: ${msg}` },
        ],
        isError: true,
      };
    }
  },
);

// Registrar herramienta: list_rules
server.tool(
  'list_rules',
  'Lista todas las reglas disponibles. Devuelve con prefijo "🎓 Según CodeMentor MCP"',
  {
    category: z.string().optional().describe('Filtrar por categoría'),
    limit: z.number().default(50).describe('Número máximo'),
  },
  async ({ category, limit }) => {
    try {
      const url = `http://localhost:${PORT}/rules${
        category ? `?category=${category}` : ''
      }&limit=${limit || 50}`;

      const response = await fetch(url);
      const data = await response.json();
      const text = formatCodeMentorResponse('list', data);
      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error';
      return {
        content: [
          { type: 'text' as const, text: `⚠️ 🎓 Según CodeMentor MCP: ${msg}` },
        ],
        isError: true,
      };
    }
  },
);

// ============================================================================
// HERRAMIENTA: web_search - Búsqueda web con Exa AI
// ============================================================================

server.tool(
  'web_search',
  'Busca información en la web usando Exa AI. Útil para buscar documentación, ejemplos, soluciones a errores, etc.',
  {
    query: z.string().describe('Término de búsqueda'),
    limit: z.number().default(10).describe('Número máximo de resultados'),
  },
  async ({ query, limit }) => {
    try {
      const url = `http://localhost:${PORT}/agents/web-search`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: query, limit }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data?.formattedResults) {
        return {
          content: [
            { type: 'text' as const, text: data.data.formattedResults },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text' as const,
              text: data.data?.message || 'No results found',
            },
          ],
          isError: !data.success,
        };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error';
      return {
        content: [
          { type: 'text' as const, text: `⚠️ Web search error: ${msg}` },
        ],
        isError: true,
      };
    }
  },
);

// Configurar Express
const app: Express = express();
app.use(express.json());

// Store active transports for message handling
const activeTransports = new Map<string, SSEServerTransport>();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', server: 'CodeMentor MCP' });
});

// SSE endpoint (GET) - establishes SSE stream
app.get('/sse', async (req, res) => {
  console.log('🔌 Nuevo cliente SSE conectado (GET /sse)');

  const transport = new SSEServerTransport('/messages', res);
  activeTransports.set(transport.sessionId, transport);

  res.on('close', () => {
    console.log('❌ Cliente SSE desconectado');
    activeTransports.delete(transport.sessionId);
  });

  await server.connect(transport);
  console.log('✅ Servidor MCP conectado al transporte SSE');
});

// Message endpoint (POST) - sends messages with sessionId
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  console.log('📨 Mensaje recibido para session:', sessionId);

  const transport = activeTransports.get(sessionId);
  if (!transport) {
    console.log('⚠️ Sesión no encontrada:', sessionId);
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Session not found' },
      id: null,
    });
    return;
  }

  await transport.handlePostMessage(req, res, req.body);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(
    `\n🎓 CodeMentor MCP Server (HTTP/SSE) corriendo en http://localhost:${PORT}`,
  );
  console.log(`📡 Endpoint SSE: http://localhost:${PORT}/sse`);
  console.log(`📬 Endpoint Message: http://localhost:${PORT}/message`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health\n`);
});

// Formateador de respuestas
function formatCodeMentorResponse(
  type: 'search' | 'get' | 'list',
  data: any,
): string {
  const prefix = '🎓 **Según CodeMentor MCP**';

  if (type === 'search') {
    if (!data.results || data.results.length === 0) {
      return `${prefix}: No encontré reglas relacionadas con tu búsqueda.`;
    }
    let response = `${prefix}: Encontré ${data.results.length} regla(s):\n\n`;
    data.results.forEach((r: any, i: number) => {
      response += `### ${i + 1}. ${r.rule.name}\n`;
      response += `**Categoría:** ${r.rule.category} | **Score:** ${(r.score * 100).toFixed(1)}%\n\n`;
      response += `${r.rule.content.substring(0, 300)}...\n\n---\n\n`;
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
    let response = `${prefix}: ${data.rules.length} regla(s):\n\n`;
    data.rules.forEach((r: any, i: number) => {
      response += `${i + 1}. **${r.name}** (\`${r.id}\`) - ${r.category}\n`;
    });
    return response.trim();
  }

  return `${prefix}: ${JSON.stringify(data, null, 2)}`;
}

/**
 * Formats response from agent system with routing info, issues, etc.
 */
function formatAgentResponse(data: any): string {
  const { data: responseData, metadata } = data;

  let text = '';

  // Add main message
  if (responseData?.message) {
    text += `${responseData.message}\n\n`;
  }

  // Add agent routing info
  if (responseData?.routedBy || responseData?.targetAgent) {
    text += `---\n🤖 **Agentes involucrados**:\n`;
    if (responseData.routedBy) {
      text += `- Router: \`${responseData.routedBy}\`\n`;
    }
    if (responseData.targetAgent) {
      text += `- Especialista: \`${responseData.targetAgent}\`\n`;
    }
    text += '\n';
  }

  // Add issue info (from PMAgent)
  if (responseData?.issue) {
    const issue = responseData.issue;
    text += `---\n📋 **Issue Creado**:\n`;
    if (issue.issueId) {
      text += `**ID**: \`${issue.issueId}\`\n`;
    }
    if (issue.title) {
      text += `**Título**: ${issue.title}\n`;
    }
    if (issue.userStory) {
      text += `\n**Historia de Usuario**:\n${issue.userStory}\n`;
    }
    if (issue.acceptanceCriteria) {
      text += `\n**Criterios de Aceptación**:\n${Array.isArray(issue.acceptanceCriteria) ? issue.acceptanceCriteria.join('\n') : issue.acceptanceCriteria}\n`;
    }
    if (issue.businessValue) {
      text += `\n**Valor de Negocio**: ${issue.businessValue}\n`;
    }
    if (issue.priority) {
      text += `\n**Prioridad**: ${issue.priority}\n`;
    }
    if (responseData.warning) {
      text += `\n⚠️ ${responseData.warning}\n`;
    }
    if (responseData.nextSteps) {
      text += `\n**Siguientes Pasos**:\n${responseData.nextSteps.map((s: string) => `- ${s}`).join('\n')}\n`;
    }
    text += '\n';
  }

  // Add user story info
  if (responseData?.userStory) {
    text += `---\n📖 **Historia de Usuario**:\n${responseData.userStory.description}\n\n`;
    if (responseData.userStory.acceptanceCriteria) {
      text += `**Criterios de Aceptación**:\n${responseData.userStory.acceptanceCriteria.join('\n')}\n\n`;
    }
  }

  // Add relevant rules
  if (responseData?.relevantRules && responseData.relevantRules.length > 0) {
    text += `---\n📚 **Reglas Aplicadas**:\n`;
    responseData.relevantRules.forEach((r: any, i: number) => {
      text += `${i + 1}. **${r.name}** (${r.category} - ${r.impact})\n`;
    });
    text += '\n';
  }

  // Add metadata
  if (metadata) {
    if (metadata.executionTime) {
      text += `⏱️ **Tiempo de ejecución**: ${metadata.executionTime}ms\n`;
    }
    if (metadata.role) {
      text += `🎯 **Rol**: ${metadata.role}\n`;
    }
  }

  return text.trim() || '✅ Consulta procesada exitosamente';
}
