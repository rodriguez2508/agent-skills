import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// MCP Server Configuration
const server = new Server(
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

// Tool Definitions
const TOOLS = [
  {
    name: 'search_rules',
    description: 'Busca reglas de código usando BM25. Devuelve reglas relevantes con el prefijo "Según CodeMentor MCP"',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Término de búsqueda (ej: "CQRS", "servicio", "repository")',
        },
        category: {
          type: 'string',
          description: 'Categoría opcional (nestjs, angular, typescript)',
        },
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
    description: 'Obtiene una regla específica por ID. Devuelve la regla con el prefijo "Según CodeMentor MCP"',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID de la regla (ej: "clean-architecture", "dependency-injection")',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_rules',
    description: 'Lista todas las reglas disponibles. Devuelve la lista con el prefijo "Según CodeMentor MCP"',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filtrar por categoría (nestjs, angular, typescript)',
        },
        limit: {
          type: 'number',
          description: 'Número máximo de resultados',
          default: 50,
        },
      },
    },
  },
];

// List Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Call Tool Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'search_rules': {
        const query = args?.query as string;
        const category = args?.category as string | undefined;
        const limit = args?.limit as number | undefined;
        
        const response = await fetch(
          `http://localhost:3000/rules/search?q=${encodeURIComponent(query)}${
            category ? `&category=${category}` : ''
          }&limit=${limit || 5}`,
        );
        const data = await response.json();
        
        result = formatCodeMentorResponse('search', data);
        break;
      }

      case 'get_rule': {
        const id = args?.id as string;
        
        const response = await fetch(
          `http://localhost:3000/rules?id=${encodeURIComponent(id)}`,
        );
        const data = await response.json();
        
        result = formatCodeMentorResponse('get', data);
        break;
      }

      case 'list_rules': {
        const category = args?.category as string | undefined;
        const limit = args?.limit as number | undefined;
        
        const response = await fetch(
          `http://localhost:3000/rules${
            category ? `?category=${category}` : ''
          }&limit=${limit || 50}`,
        );
        const data = await response.json();
        
        result = formatCodeMentorResponse('list', data);
        break;
      }

      default:
        throw new Error(`Herramienta desconocida: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return {
      content: [
        {
          type: 'text',
          text: `⚠️ **Según CodeMentor MCP**: Ocurrió un error al procesar tu solicitud: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Formatea las respuestas con el prefijo "Según CodeMentor MCP"
 */
function formatCodeMentorResponse(type: 'search' | 'get' | 'list', data: any): string {
  const prefix = '🎓 **Según CodeMentor MCP**';
  
  switch (type) {
    case 'search': {
      if (!data.results || data.results.length === 0) {
        return `${prefix}: No encontré reglas relacionadas con tu búsqueda. Te sugiero intentar con otros términos.`;
      }

      let response = `${prefix}: Encontré ${data.results.length} regla(s) relevante(s):\n\n`;
      
      data.results.forEach((result: any, index: number) => {
        response += `### ${index + 1}. ${result.rule.name}\n`;
        response += `**Categoría:** ${result.rule.category}\n`;
        response += `**Relevancia:** ${(result.score * 100).toFixed(1)}%\n`;
        response += `**Tags:** ${result.rule.tags.join(', ')}\n\n`;
        response += `${truncateContent(result.rule.content, 500)}\n\n`;
        response += `---\n\n`;
      });

      return response.trim();
    }

    case 'get': {
      if (!data.rule) {
        return `${prefix}: No encontré una regla con ese ID. Verifica el identificador.`;
      }

      let response = `${prefix}: Aquí está la regla solicitada:\n\n`;
      response += `# ${data.rule.name}\n\n`;
      response += `**ID:** ${data.rule.id}\n`;
      response += `**Categoría:** ${data.rule.category}\n`;
      response += `**Impacto:** ${data.rule.impact}\n`;
      response += `**Tags:** ${data.rule.tags.join(', ')}\n\n`;
      response += `${data.rule.content}\n`;

      return response.trim();
    }

    case 'list': {
      if (!data.rules || data.rules.length === 0) {
        return `${prefix}: No hay reglas disponibles en este momento.`;
      }

      let response = `${prefix}: Encontré ${data.rules.length} regla(s) disponible(s):\n\n`;
      
      const groupedByCategory = data.rules.reduce((acc: any, rule: any) => {
        if (!acc[rule.category]) acc[rule.category] = [];
        acc[rule.category].push(rule);
        return acc;
      }, {});

      for (const [category, rules] of Object.entries(groupedByCategory)) {
        response += `## 📁 ${category.toUpperCase()}\n\n`;
        (rules as any[]).forEach((rule, index) => {
          response += `${index + 1}. **${rule.name}** (\`${rule.id}\`)\n`;
        });
        response += '\n';
      }

      return response.trim();
    }

    default:
      return `${prefix}: ${JSON.stringify(data, null, 2)}`;
  }
}

/**
 * Trunca el contenido si es muy largo
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '\n\n*(...contenido truncado...)';
}

// Start Server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CodeMentor MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
