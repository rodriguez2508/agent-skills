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
      'Ejecuta un agente registrado por su ID. Usa list_agents para ver agentes disponibles. Mantiene sessionId/issueId/projectPath para preservar contexto entre llamadas.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          description:
            'ID del agente a ejecutar (ej: router, analysis, code, architecture, pm, github)',
        },
        task: { type: 'string', description: 'Tarea para el agente' },
        projectPath: {
          type: 'string',
          description: 'Path al proyecto (opcional)',
        },
        sessionId: {
          type: 'string',
          description: 'ID de sesión activa (opcional)',
        },
        issueId: {
          type: 'string',
          description: 'ID de issue activo (opcional)',
        },
        clearContext: {
          type: 'boolean',
          default: false,
          description: 'Si true, ignora contexto previo',
        },
      },
      required: ['agent', 'task'],
    },
  },
  {
    name: 'list_agents',
    description:
      'Lista todos los agentes registrados en el sistema con su descripción. Útil antes de usar execute_agent.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'session_start',
    description:
      'Inicia (o reusa) una sesión MCP. Detecta proyecto desde projectPath, registra usuario por IP, precarga issue activo y su contexto (mensajes recientes, decisiones clave, archivos modificados). Retorna sessionId, projectId, issueId, recentContext, availableAgents.',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description:
            'Identificador único del cliente (Claude Code, Qwen, etc.)',
        },
        projectPath: {
          type: 'string',
          description: 'Path absoluto al proyecto (auto-detect si se omite)',
        },
        projectName: {
          type: 'string',
          description: 'Nombre del proyecto (si no se da projectPath)',
        },
        title: {
          type: 'string',
          description: 'Título descriptivo de la sesión',
        },
      },
    },
  },
  {
    name: 'session_resume',
    description:
      'Reanuda una sesión existente y retorna su historial completo (últimos N mensajes, issue activo con decisiones clave y workflow). Usa sessionId o clientId.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'ID de la sesión a reanudar',
        },
        clientId: {
          type: 'string',
          description: 'Identificador del cliente (alternativa a sessionId)',
        },
        messagesLimit: {
          type: 'number',
          default: 30,
          description: 'Número máximo de mensajes a retornar (max 100)',
        },
      },
    },
  },
  {
    name: 'chat_with_agents',
    description:
      'Envía un mensaje al sistema multi-agente manteniendo el contexto de la sesión y issue activo. Auto-enruta al agente correcto y persiste el historial. Versión enriquecida de agent_query con contexto.',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Tu mensaje o consulta' },
        sessionId: {
          type: 'string',
          description:
            'ID de sesión (obtener vía session_start o session_resume)',
        },
        clientId: {
          type: 'string',
          description: 'ID del cliente (alternativa a sessionId)',
        },
        agentHint: {
          type: 'string',
          description:
            'Sugerencia de agente específico (opcional, ej: code, pm)',
        },
      },
      required: ['input'],
    },
  },
  {
    name: 'session_init_auto',
    description:
      'Inicialización automática al arrancar Claude Code. Detecta el proyecto desde el cwd, crea la sesión en BD, registra el proyecto por nombre de carpeta y devuelve el catálogo de agentes disponibles (BM2) en JSON. Llamar SIEMPRE como primer acto de cada conversación.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description:
            'Directorio de trabajo actual (process.cwd()). Requerido.',
        },
        clientId: {
          type: 'string',
          description: 'Identificador único del cliente MCP (opcional)',
        },
        userAgent: {
          type: 'string',
          description: 'Nombre del cliente (ej: claude-code, qwen)',
        },
      },
      required: ['cwd'],
    },
  },
  {
    name: 'register_plan',
    description:
      'Crea un plan de trabajo en la base de datos explícitamente. Útil para registrar intenciones de trabajo, tareas técnicas o issues que se van a implementar. Similar al flujo de agent_query pero sin ejecutar agentes. Requiere al menos title y projectPath o sessionId.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Título descriptivo del plan (obligatorio)',
        },
        summary: {
          type: 'string',
          description: 'Resumen detallado del plan (opcional)',
        },
        projectPath: {
          type: 'string',
          description: 'Path al proyecto (opcional si se da sessionId)',
        },
        sessionId: {
          type: 'string',
          description: 'ID de sesión MCP (opcional si se da projectPath)',
        },
        intention: {
          type: 'string',
          description:
            'Intención detectada (code, analysis, pm, architecture, etc.)',
        },
        agentId: {
          type: 'string',
          description: 'Agente responsable del plan (opcional)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_plans',
    description:
      'Lista los planes activos para una sesión o proyecto. Si se da sessionId, devuelve el plan activo. Si se da projectId, devuelve todos los planes.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'ID de sesión (opcional)',
        },
        projectId: {
          type: 'string',
          description: 'ID de proyecto (opcional)',
        },
        status: {
          type: 'string',
          description:
            'Filtrar por estado (open, in_progress, completed, abandoned)',
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
          `${API_URL}/rules?id=${encodeURIComponent(id)}`,
        );
        const data = await response.json();

        result = formatCodeMentorResponse('get', data);
        break;
      }

      case 'list_rules': {
        const category = args?.category as string | undefined;
        const limit = args?.limit as number | undefined;

        const qs = new URLSearchParams();
        if (category) qs.set('category', category);
        qs.set('limit', String(limit || 50));

        const response = await fetch(`${API_URL}/rules?${qs.toString()}`);
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
        const sessionId = args?.sessionId as string | undefined;
        const issueId = args?.issueId as string | undefined;
        const clearContext = (args?.clearContext as boolean) ?? false;

        const response = await fetch(`${API_URL}/agents/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent,
            task,
            projectPath,
            sessionId,
            issueId,
            clearContext,
          }),
        });

        if (!response.ok) {
          throw new Error(`Agent execution failed: ${response.status}`);
        }

        const agentData = await response.json();
        if (agentData.success === false) {
          result = `⚠️ ${agentData.error || 'Agent execution failed'}`;
          break;
        }

        const nextAction = agentData.data?.nextAction;
        let responseMessage = agentData.data?.message || '';

        if (nextAction) {
          responseMessage += `\n\n📋 **Próxima acción**: agente \`${nextAction.agent}\``;
          responseMessage += `\nTarea: "${(nextAction.task || '').substring(0, 200)}"`;
        }

        if (agentData.data?.relevantRules?.length > 0) {
          responseMessage += `\n\n📚 **Reglas aplicadas**: ${agentData.data.relevantRules.length}`;
        }

        result = responseMessage;
        break;
      }

      case 'list_agents': {
        const response = await fetch(`${API_URL}/agents/list`);
        const data = await response.json();
        const agents: Array<{ id: string; description: string }> =
          data.agents || [];
        let text = `🤖 **Agentes registrados** (${data.count}):\n\n`;
        agents.forEach((a) => {
          text += `- \`${a.id}\` — ${a.description}\n`;
        });
        result = text.trim();
        break;
      }

      case 'session_start': {
        const clientId =
          (args?.clientId as string | undefined) ||
          `claude-code-${process.pid}`;
        const projectPath =
          (args?.projectPath as string | undefined) ||
          (await detectProjectPath()) ||
          undefined;
        const projectName = args?.projectName as string | undefined;
        const title = args?.title as string | undefined;

        const response = await fetch(`${API_URL}/mcp/session/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': clientId,
          },
          body: JSON.stringify({ clientId, projectPath, projectName, title }),
        });

        if (!response.ok) {
          throw new Error(`session_start failed: ${response.status}`);
        }

        const data = await response.json();
        result = formatSessionStart(data);
        break;
      }

      case 'session_resume': {
        const sessionId = args?.sessionId as string | undefined;
        const clientId =
          (args?.clientId as string | undefined) ||
          `claude-code-${process.pid}`;
        const messagesLimit = args?.messagesLimit as number | undefined;

        const response = await fetch(`${API_URL}/mcp/session/resume`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': clientId,
          },
          body: JSON.stringify({ sessionId, clientId, messagesLimit }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(
            `session_resume failed: ${response.status} — ${errText}`,
          );
        }

        const data = await response.json();
        result = formatSessionResume(data);
        break;
      }

      case 'chat_with_agents': {
        const input = args?.input as string;
        const clientId =
          (args?.clientId as string | undefined) ||
          `claude-code-${process.pid}`;
        let sessionId = args?.sessionId as string | undefined;
        const agentHint = args?.agentHint as string | undefined;

        // Auto-start session if not provided
        if (!sessionId) {
          const projectPath = (await detectProjectPath()) || undefined;
          const startResp = await fetch(`${API_URL}/mcp/session/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-client-id': clientId,
            },
            body: JSON.stringify({ clientId, projectPath }),
          });
          if (startResp.ok) {
            const startData = await startResp.json();
            sessionId = startData.session?.sessionId;
          }
        }

        const response = await fetch(`${API_URL}/mcp/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': clientId,
          },
          body: JSON.stringify({
            input,
            sessionId,
            agentHint,
            options: { autoCreateIssue: true, trackInteractions: true },
          }),
        });

        if (!response.ok) {
          throw new Error(`chat_with_agents failed: ${response.status}`);
        }

        const data = await response.json();
        result = formatAgentResponse(data);
        if (sessionId) {
          result += `\n\n🔗 **sessionId**: \`${sessionId}\``;
        }
        break;
      }

      case 'session_init_auto': {
        const cwd =
          (args?.cwd as string) || (await detectProjectPath()) || process.cwd();
        const clientId =
          (args?.clientId as string | undefined) ||
          `claude-code-${process.pid}`;
        const userAgent =
          (args?.userAgent as string | undefined) || 'claude-code';

        const response = await fetch(`${API_URL}/mcp/session/init-auto`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': clientId,
          },
          body: JSON.stringify({ cwd, clientId, userAgent }),
        });

        if (!response.ok) {
          throw new Error(`session_init_auto failed: ${response.status}`);
        }

        const data = await response.json();
        // Devolver JSON estructurado para que el CLI pueda parsear
        result = JSON.stringify(data, null, 2);
        break;
      }

      case 'register_plan': {
        const title = args?.title as string;
        const summary = args?.summary as string | undefined;
        const projectPath =
          (args?.projectPath as string | undefined) ||
          (await detectProjectPath()) ||
          undefined;
        const sessionId = args?.sessionId as string | undefined;
        const intention = args?.intention as string | undefined;
        const agentId = args?.agentId as string | undefined;

        const body: Record<string, any> = { title };
        if (summary) body.summary = summary;
        if (projectPath) body.projectPath = projectPath;
        if (sessionId) body.sessionId = sessionId;
        if (intention) body.intention = intention;
        if (agentId) body.agentId = agentId;

        const response = await fetch(`${API_URL}/mcp/plans/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`register_plan failed: ${response.status}`);
        }

        const planData = await response.json();
        if (!planData.success) {
          result = `⚠️ No se pudo crear el plan: ${planData.error || 'error desconocido'}`;
          break;
        }
        result =
          `📋 **Plan registrado exitosamente**\n\n` +
          `**ID**: \`${planData.data.id}\`\n` +
          `**Título**: ${planData.data.title}\n` +
          `**Estado**: ${planData.data.status}\n\n` +
          `El plan ha sido guardado en la base de datos. Puedes consultarlo con \`list_plans\`.`;
        break;
      }

      case 'list_plans': {
        const listSessionId = args?.sessionId as string | undefined;
        const listProjectId = args?.projectId as string | undefined;
        const listStatus = args?.status as string | undefined;

        const qs = new URLSearchParams();
        if (listSessionId) qs.set('sessionId', listSessionId);
        if (listProjectId) qs.set('projectId', listProjectId);
        if (listStatus) qs.set('status', listStatus);

        const response = await fetch(`${API_URL}/mcp/plans?${qs.toString()}`);

        if (!response.ok) {
          throw new Error(`list_plans failed: ${response.status}`);
        }

        const plansData = await response.json();
        const plans: any[] = plansData.data || [];

        if (plans.length === 0) {
          result =
            'No hay planes registrados para los criterios especificados.';
          break;
        }

        let text = `📋 **Planes encontrados** (${plans.length}):\n\n`;
        plans.forEach((p: any, i: number) => {
          const planInfo = p.plan || {};
          text += `${i + 1}. **${p.title}**\n`;
          text += `   ID: \`${p.id}\` | Estado: ${p.status}\n`;
          text += `   Agente: ${p.agentId || '-'} | Sesión: ${p.sessionId || '-'}\n`;
          if (planInfo.detectedIntention) {
            text += `   Intención: ${planInfo.detectedIntention}\n`;
          }
          text += `   Creado: ${new Date(p.createdAt).toLocaleString()}\n\n`;
        });
        result = text.trim();
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

/**
 * Format response from POST /mcp/session/start
 */
function formatSessionStart(data: any): string {
  if (!data?.success) {
    return `⚠️ session_start failed: ${data?.error ?? 'unknown error'}`;
  }

  const s = data.session;
  const p = data.project;
  const c = data.recentContext;
  const agents: Array<{ id: string; description: string }> =
    data.availableAgents || [];

  let text = `✅ **Sesión iniciada**: \`${s.sessionId}\`\n`;
  text += `**User**: ${s.userId}\n`;
  if (p) {
    text += `\n📁 **Proyecto**: ${p.name} (\`${p.id}\`)\n`;
    if (p.framework) text += `- Framework: ${p.framework}\n`;
    if (p.architecture) text += `- Arquitectura: ${p.architecture}\n`;
  }
  if (c) {
    text += `\n📋 **Issue activo**: ${c.title} (\`${c.issueId}\`)\n`;
    text += `- Status: ${c.status} | Workflow: ${c.currentWorkflowStep}\n`;
    if (c.completedSteps?.length) {
      text += `- Completados: ${c.completedSteps.join(', ')}\n`;
    }
    if (c.nextSteps?.length) {
      text += `- Próximos: ${c.nextSteps.slice(0, 3).join('; ')}\n`;
    }
    if (c.keyDecisions?.length) {
      text += `- Decisiones clave: ${c.keyDecisions.length}\n`;
    }
    if (c.recentMessages?.length) {
      text += `- Mensajes recientes en caché: ${c.recentMessages.length}\n`;
    }
  }
  if (agents.length) {
    text += `\n🤖 **${agents.length} agentes disponibles** (usa execute_agent o chat_with_agents).\n`;
  }
  return text.trim();
}

/**
 * Format response from POST /mcp/session/resume
 */
function formatSessionResume(data: any): string {
  if (!data?.success) {
    return `⚠️ session_resume failed: ${data?.error ?? 'unknown error'}`;
  }

  const s = data.session;
  const p = data.project;
  const i = data.issue;
  const messages = data.messages || [];

  let text = `🔄 **Sesión reanudada**: \`${s.sessionId}\` (${s.status})\n`;
  text += `- Mensajes totales: ${s.messageCount} | Última actividad: ${s.lastActivityAt}\n`;
  if (p) text += `\n📁 **Proyecto**: ${p.name}\n`;
  if (i) {
    text += `\n📋 **Issue**: ${i.title}\n`;
    text += `- Status: ${i.status} | Workflow: ${i.currentWorkflowStep}\n`;
    if (i.keyDecisions?.length) {
      text += `\n**Decisiones clave**:\n`;
      i.keyDecisions.slice(0, 5).forEach((d: string, idx: number) => {
        text += `${idx + 1}. ${d}\n`;
      });
    }
    if (i.filesModified?.length) {
      text += `\n**Archivos modificados** (${i.filesModified.length}): ${i.filesModified.slice(0, 5).join(', ')}\n`;
    }
    if (i.summary) text += `\n**Summary**: ${i.summary}\n`;
  }
  if (messages.length) {
    text += `\n💬 **Últimos ${messages.length} mensajes**:\n`;
    messages.slice(-10).forEach((m: any) => {
      const preview = String(m.content).substring(0, 120);
      text += `- [${m.role}${m.agentId ? '/' + m.agentId : ''}] ${preview}${m.content.length > 120 ? '...' : ''}\n`;
    });
  }
  return text.trim();
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
