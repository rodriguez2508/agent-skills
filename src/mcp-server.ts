import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

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

const PORT = process.env.PORT || 8004;
const API_URL = `http://localhost:${PORT}`;

// Tool Definitions
const TOOLS = [
  {
    name: 'agent_query',
    description:
      'Consulta principal con agentes especializados. Auto-detecta intención y enruta al agente correcto (PMAgent, CodeAgent, SearchAgent, etc.). Crea issues automáticamente y mantiene historial.',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Tu consulta o petición',
        },
        sessionId: {
          type: 'string',
          description: 'ID de sesión para mantener historial (opcional)',
        },
        userId: {
          type: 'string',
          description: 'ID de usuario (opcional)',
        },
        projectPath: {
          type: 'string',
          description: 'Path al proyecto (auto-detect si no se proporciona)',
        },
      },
      required: ['input'],
    },
  },
  {
    name: 'search_rules',
    description:
      'Busca reglas de código usando BM25. Devuelve reglas relevantes con el prefijo "Según CodeMentor MCP"',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Término de búsqueda (ej: "CQRS", "servicio", "repository")',
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
    description:
      'Obtiene una regla específica por ID. Devuelve la regla con el prefijo "Según CodeMentor MCP"',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'ID de la regla (ej: "clean-architecture", "dependency-injection")',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_rules',
    description:
      'Lista todas las reglas disponibles. Devuelve la lista con el prefijo "Según CodeMentor MCP"',
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
  {
    name: 'context7_docs',
    description:
      'Fetches up-to-date, version-specific documentation for libraries using Context7. Use when asking about library docs, API usage, or framework setup.',
    inputSchema: {
      type: 'object',
      properties: {
        library: {
          type: 'string',
          description:
            'Library name or ID (e.g., "Next.js" or "/vercel/next.js")',
        },
        query: {
          type: 'string',
          description:
            'What you need help with (e.g., "middleware authentication")',
        },
      },
      required: ['library', 'query'],
    },
  },
  {
    name: 'execute_agent',
    description:
      'Ejecuta un agente específico con contexto limpio. Usado para ejecutar sub-agentes con sus skills/rules. Devuelve nextAction para continuar el flujo.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          enum: ['router', 'analysis'],
          description: 'Agente a ejecutar (router o analysis)',
        },
        task: {
          type: 'string',
          description: 'Tarea o pregunta para el agente',
        },
        projectPath: {
          type: 'string',
          description: 'Path al proyecto (opcional)',
        },
        clearContext: {
          type: 'boolean',
          default: true,
          description: 'Limpiar contexto previo antes de ejecutar',
        },
      },
      required: ['agent', 'task'],
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
      case 'agent_query': {
        // Main agent query - uses RouterAgent + specialized agents
        const input = args?.input as string;
        const sessionId = args?.sessionId as string | undefined;
        const userId = args?.userId as string | undefined;
        const projectPath = args?.projectPath as string | undefined;

        // Auto-detect project path if not provided
        const detectedPath = projectPath || (await detectProjectPath());

        // Auto-detect project metadata
        let projectContext = null;
        if (detectedPath) {
          projectContext = await detectProject(detectedPath);
        }

        const session = sessionId || `session-${Date.now()}`;

        const response = await fetch(`${API_URL}/mcp/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input,
            sessionId: session,
            projectPath: detectedPath,
            projectContext,
            options: {
              userId,
              autoCreateIssue: true,
              trackInteractions: true,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        result = formatAgentResponse(data, {
          projectPath: detectedPath || undefined,
          projectContext,
        });
        break;
      }

      case 'search_rules': {
        const query = args?.query as string;
        const category = args?.category as string | undefined;
        const limit = args?.limit as number | undefined;

        const response = await fetch(
          `http://localhost:${PORT}/rules/search?q=${encodeURIComponent(query)}${
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

      case 'context7_docs': {
        const library = args?.library as string;
        const query = args?.query as string;

        const context7ApiKey = process.env.CONTEXT7_API_KEY || '';
        const context7Enabled = process.env.CONTEXT7_ENABLED === 'true';

        if (!context7Enabled || !context7ApiKey) {
          result =
            '⚠️ Context7 is not enabled. Set CONTEXT7_ENABLED=true and CONTEXT7_API_KEY in your environment.';
          break;
        }

        const apiBaseUrl = 'https://context7.com/api/v2';
        const libraryId = library.startsWith('/') ? library : null;

        let docsResult: string;

        if (libraryId) {
          // Direct library ID
          const docsResponse = await fetch(
            `${apiBaseUrl}/context?libraryId=${encodeURIComponent(libraryId)}&query=${encodeURIComponent(query)}`,
            {
              headers: {
                Authorization: `Bearer ${context7ApiKey}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (!docsResponse.ok) {
            docsResult = `Error fetching documentation: ${docsResponse.status} ${docsResponse.statusText}`;
          } else {
            const docsData = await docsResponse.json();
            docsResult =
              docsData.context ||
              docsData.documentation ||
              'No documentation found.';
          }
        } else {
          // Search by library name first
          const searchResponse = await fetch(
            `${apiBaseUrl}/libs/search?query=${encodeURIComponent(library)}&libraryName=${encodeURIComponent(library)}`,
            {
              headers: {
                Authorization: `Bearer ${context7ApiKey}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (!searchResponse.ok) {
            docsResult = `Error searching library: ${searchResponse.status} ${searchResponse.statusText}`;
          } else {
            const searchData = await searchResponse.json();
            if (!searchData.results || searchData.results.length === 0) {
              docsResult = `Library "${library}" not found in Context7 index. Check https://context7.com for available libraries.`;
            } else {
              const foundLibrary = searchData.results[0];
              const docsResponse = await fetch(
                `${apiBaseUrl}/context?libraryId=${encodeURIComponent(foundLibrary.id)}&query=${encodeURIComponent(query)}`,
                {
                  headers: {
                    Authorization: `Bearer ${context7ApiKey}`,
                    'Content-Type': 'application/json',
                  },
                },
              );

              if (!docsResponse.ok) {
                docsResult = `Error fetching documentation: ${docsResponse.status} ${docsResponse.statusText}`;
              } else {
                const docsData = await docsResponse.json();
                docsResult =
                  docsData.context ||
                  docsData.documentation ||
                  'No documentation found.';
              }
            }
          }
        }

        result = `📚 **Documentation for** \`${library}\`\n\n**Query**: ${query}\n\n---\n\n${docsResult}`;
        break;
      }

      case 'execute_agent': {
        const agent = args?.agent as string;
        const task = args?.task as string;
        const projectPath = args?.projectPath as string | undefined;
        const clearContext = (args?.clearContext as boolean) ?? true;

        console.error(
          `🔧 [MCP] execute_agent: ${agent} | task: ${task.substring(0, 50)}... | clearContext: ${clearContext}`,
        );

        // Build request for the agent
        const agentRequest = {
          input: task,
          options: {
            projectPath,
            clearContext,
          },
        };

        // Call the internal agent endpoint
        const response = await fetch(`${API_URL}/agents/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentRequest),
        });

        if (!response.ok) {
          throw new Error(`Agent execution failed: ${response.status}`);
        }

        const agentData = await response.json();

        // Format the response with nextAction info
        const targetAgent = agentData.data?.targetAgent || agent;
        const nextAction = agentData.data?.nextAction;

        let responseMessage = agentData.data?.message || '';

        // Add nextAction instructions for Qwen
        if (nextAction) {
          responseMessage += `\n\n📋 **Acción próxima**: Debes ejecutar el agente \`${nextAction.agent}\` con la tarea: "${nextAction.task?.substring(0, 100)}..."`;
          responseMessage += `\n\nPara continuar, usa el tool \`execute_agent\` con:\n- agent: "${nextAction.agent}"\n- task: "${nextAction.task}"\n- projectPath: ${projectPath ? `"${projectPath}"` : 'null'}`;
        }

        // Add relevant rules if present
        if (agentData.data?.relevantRules?.length > 0) {
          responseMessage += `\n\n📚 **Reglas aplicadas**: ${agentData.data.relevantRules.length} regla(s) encontrada(s)`;
        }

        result = responseMessage;
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
    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido';
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
function formatCodeMentorResponse(
  type: 'search' | 'get' | 'list',
  data: any,
): string {
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

/**
 * Formats response from agent system with routing info, issues, etc.
 * Now includes project context info
 */
function formatAgentResponse(
  data: any,
  context?: { projectPath?: string; projectContext?: any },
): string {
  const { data: responseData, metadata } = data;

  let text = '';

  // Add main message
  if (responseData?.message) {
    text += `${responseData.message}\n\n`;
  }

  // Add project context info
  if (context?.projectContext) {
    text += `---\n📁 **Proyecto Detectado**:\n`;
    text += `- Nombre: \`${context.projectContext.name}\`\n`;
    if (context.projectContext.version) {
      text += `- Versión: ${context.projectContext.version}\n`;
    }
    if (context.projectContext.detectedFramework) {
      text += `- Framework: ${context.projectContext.detectedFramework}\n`;
    }
    if (context.projectContext.language) {
      text += `- Lenguaje: ${context.projectContext.language}\n`;
    }
    text += '\n';
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

/**
 * Detecta path del proyecto automáticamente
 * Busca package.json desde directorio actual hacia arriba
 */
async function detectProjectPath(): Promise<string | null> {
  let currentDir = process.cwd();

  while (currentDir !== path.parse(currentDir).root) {
    const packageJsonPath = path.join(currentDir, 'package.json');

    try {
      await fs.access(packageJsonPath);
      return currentDir;
    } catch {
      currentDir = path.dirname(currentDir);
    }
  }

  return null;
}

/**
 * Detecta metadata del proyecto
 */
async function detectProject(projectPath: string): Promise<any> {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    return {
      name: packageJson.name,
      version: packageJson.version,
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies,
      detectedFramework: detectFramework(packageJson),
      language: detectLanguage(packageJson),
    };
  } catch {
    return null;
  }
}

/**
 * Detecta framework basado en dependencias
 */
function detectFramework(packageJson: any): string {
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  if (deps['@angular/core']) return 'angular';
  if (deps['@nestjs/common']) return 'nestjs';
  if (deps['react']) return 'react';
  if (deps['vue']) return 'vue';
  if (deps['express']) return 'node-express';
  if (deps['fastify']) return 'node-fastify';
  if (deps['next']) return 'nextjs';
  if (deps['nuxt']) return 'nuxtjs';

  return 'node';
}

/**
 * Detecta lenguaje principal
 */
function detectLanguage(packageJson: any): string {
  if (
    packageJson.dependencies?.['@angular/core'] ||
    packageJson.dependencies?.['@nestjs/common']
  ) {
    return 'TypeScript';
  }

  const hasTs = packageJson.dependencies?.['typescript'];
  const hasJs = packageJson.dependencies?.['@babel/core'];

  if (hasTs) return 'TypeScript';
  if (hasJs) return 'JavaScript';

  return 'Unknown';
}

// Start Server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CodeMentor MCP Server running on stdio');
  console.error(`Auto-detect project: ${process.cwd()}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
