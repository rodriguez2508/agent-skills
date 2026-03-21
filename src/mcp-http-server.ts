import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Express } from 'express';
import express from 'express';
import { z } from 'zod';

const PORT = process.env.PORT || 8004;

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

// Registrar herramienta: search_rules
server.tool(
  'search_rules',
  'Busca reglas de código usando BM25. Devuelve reglas con el prefijo "🎓 Según CodeMentor MCP"',
  {
    query: z.string().describe('Término de búsqueda'),
    category: z.string().optional().describe('Categoría opcional (nestjs, angular, typescript)'),
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
      return { content: [{ type: 'text' as const, text: `⚠️ 🎓 Según CodeMentor MCP: ${msg}` }], isError: true };
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
      const response = await fetch(`http://localhost:${PORT}/rules?id=${encodeURIComponent(id)}`);
      const data = await response.json();
      const text = formatCodeMentorResponse('get', data);
      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error';
      return { content: [{ type: 'text' as const, text: `⚠️ 🎓 Según CodeMentor MCP: ${msg}` }], isError: true };
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
      return { content: [{ type: 'text' as const, text: `⚠️ 🎓 Según CodeMentor MCP: ${msg}` }], isError: true };
    }
  },
);

// Configurar Express
const app: Express = express();
app.use(express.json());

// Endpoint SSE
app.get('/sse', async (req, res) => {
  console.log('🔌 Nuevo cliente SSE conectado');
  
  const transport = new SSEServerTransport('/message', res);
  
  res.on('close', () => {
    console.log('❌ Cliente SSE desconectado');
  });
  
  await server.connect(transport);
});

// Endpoint Message
app.post('/message', async (req, res) => {
  console.log('📨 Mensaje recibido');
  res.status(200).send();
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🎓 CodeMentor MCP Server (HTTP/SSE) corriendo en http://localhost:${PORT}`);
  console.log(`📡 Endpoint SSE: http://localhost:${PORT}/sse`);
  console.log(`📬 Endpoint Message: http://localhost:${PORT}/message\n`);
});

// Formateador de respuestas
function formatCodeMentorResponse(type: 'search' | 'get' | 'list', data: any): string {
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
