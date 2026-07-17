import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { BaseAgent } from '@core/agents/base.agent';
import {
  AgentRequest,
  AgentResponse,
  AgentAction,
} from '@core/agents/agent-response';
import { AgentRegistry } from '@core/agents/agent-registry';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import {
  RecordTransitionCommand,
  RecordConfirmationCommand,
  RecordRejectionCommand,
  RecordInvocationCommand,
  StorePendingNextCommand,
  SetLastAgentCommand,
} from '@modules/agency-agents/application/commands';
import {
  GetSuggestedNextQuery,
  ConsumePendingNextQuery,
  GetLastAgentQuery,
} from '@modules/agency-agents/application/queries';
import { SuggestedNext } from '@modules/agency-agents/application/queries/get-suggested-next/get-suggested-next.handler';
import { McpPlanService } from '@modules/plans/application/services/mcp-plan.service';
import { MemoryFileService } from '@modules/memory/services/memory-file.service';

/**
 * RouterAgent - Orquestador principal de agentes
 * Detecta la intención del usuario y enruta al agente especializado
 * Automatically searches for relevant code rules on every request
 */
@Injectable()
export class RouterAgent extends BaseAgent {
  private readonly rulesApiUrl: string;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly agentRegistry: AgentRegistry,
    private readonly agentLogger: AgentLoggerService,
    private readonly mcpPlanService: McpPlanService,
    private readonly memoryFileService: MemoryFileService,
  ) {
    super(
      'RouterAgent',
      'Orquesta y enruta solicitudes a los agentes especializados, inyectando reglas y memoria L1 automáticamente',
    );
    this.rulesApiUrl = `http://localhost:${process.env.PORT || 8004}/rules/search`;
  }

  /**
   * Maneja la solicitud detectando intención y enrutando
   * Automatically searches for relevant rules before routing
   * Agent rules are ALWAYS applied first, then context rules
   */
  protected async handle(request: AgentRequest): Promise<AgentResponse> {
    this.agentLogger.info(
      this.agentId,
      '📥 [ROUTER] Recibida solicitud de enrutamiento',
      {
        input: request.input.substring(0, 100),
        options: request.options,
      },
    );

    // STEP 1: ALWAYS apply agent rules (language, organization, interaction)
    const agentRules = await this.searchRelevantRulesByCategory('agent');

    // STEP 2: Search for context-specific rules (Angular, NestJS, etc.)
    const contextRules = await this.searchRelevantRules(request.input);

    // Combine: agent rules first, then context rules
    const allRules = [...agentRules, ...contextRules];

    // Build system instructions that MUST be followed
    const systemInstructions = this.buildSystemInstructions(
      allRules,
      request.options?.language,
    );

    // STEP 3: Inject L1 Memory (MEMORY.md + USER.md) — auto-inyectado como Hermes
    const memoryContext = await this.memoryFileService.buildInjectedContext();
    if (memoryContext) {
      this.agentLogger.info(
        this.agentId,
        `🧠 [ROUTER] L1 Memory injected: ${memoryContext.split('\n').length} lines`,
      );
    }

    // Prepend system instructions + L1 memory to the input
    const finalInput = systemInstructions + memoryContext + request.input;

    if (allRules.length > 0) {
      this.agentLogger.info(
        this.agentId,
        `📚 [ROUTER] Found ${allRules.length} rules (${agentRules.length} agent + ${contextRules.length} context)`,
        {
          agentRules: agentRules.map((r) => r.name),
          contextRules: contextRules.map((r) => r.name),
        },
      );
    }

    // Update request with rules and final input
    request.input = finalInput;
    request.options = {
      ...request.options,
      relevantRules: allRules,
      rulesContext: this.formatRulesContext(allRules),
    };

    const sessionId: string | undefined = request.options?.sessionId;
    const projectId: string | undefined = request.options?.projectId;
    const rawInput: string = request.options?.rawInput ?? request.input;

    // Detectar intención — usar rawInput (sin reglas prepended)
    const intention = this.detectIntention(rawInput);

    this.agentLogger.info(
      this.agentId,
      `🧠 [ROUTER] Intención detectada: ${intention}`,
      { inputPreview: rawInput.substring(0, 50) },
    );

    // ── CAPA 4: Confirmación / Rechazo de sugerencia pendiente ──────────────
    if (intention === 'confirm-suggested' && sessionId) {
      const pending = await this.queryBus.execute(new ConsumePendingNextQuery(sessionId));
      if (pending) {
        this.agentLogger.info(
          this.agentId,
          `✅ [ROUTER] Confirmando sugerencia: ${pending.agentId}`,
        );

        if (projectId) {
          await this.commandBus.execute(new RecordConfirmationCommand(
            projectId,
            pending.fromAgentId,
            pending.agentId,
          ));
        }

        const confirmedAgent = this.agentRegistry.getAgent(pending.agentId);
        if (confirmedAgent) {
          // Crear mcp_plan antes de ejecutar el agente confirmado
          let planId: string | undefined;
          if (sessionId && this.isTechnicalTask(pending.intention || 'code')) {
            try {
              const existingPlan =
                await this.mcpPlanService.findBySession(sessionId);
              if (!existingPlan) {
                const title = this.buildPlanTitle(
                  rawInput,
                  pending.intention || 'code',
                );
                const plan = await this.mcpPlanService.create({
                  title,
                  projectId,
                  sessionId,
                  agentId: confirmedAgent.agentId,
                  plan: {
                    summary: `Confirmado por usuario: ${rawInput.substring(0, 300)}`,
                    detectedIntention: pending.intention || 'code',
                    steps: [
                      {
                        order: 1,
                        description: `Ejecutar ${confirmedAgent.agentId}`,
                        agentId: confirmedAgent.agentId,
                        status: 'in_progress',
                      },
                    ],
                    rulesApplied: allRules.map((r) => ({
                      id: r.id,
                      name: r.name,
                      category: r.category,
                    })),
                    agentsInvolved: [confirmedAgent.agentId],
                  },
                });
                planId = plan.id;
              } else {
                planId = existingPlan.id;
              }
            } catch (error) {
              this.agentLogger.warn(
                this.agentId,
                `⚠️ No se pudo crear plan (confirmación): ${error.message}`,
              );
            }
          }

          // Registrar invocación y transición
          if (sessionId && projectId) {
            const lastAgent = await this.queryBus.execute(new GetLastAgentQuery(sessionId));
            this.commandBus
              .execute(new RecordInvocationCommand(
                confirmedAgent.agentId,
                sessionId,
                projectId,
                rawInput,
                `Confirmado por usuario → ${confirmedAgent.agentId}`,
                allRules.map((r) => ({
                  id: r.id,
                  name: r.name,
                  category: r.category,
                })),
              ))
              .catch(() => {});
            this.commandBus.execute(new RecordTransitionCommand(
                projectId,
                lastAgent,
                confirmedAgent.agentId,
                pending.intention || 'code',
                rawInput,
              ))
              .catch(() => {});
            await this.commandBus.execute(new SetLastAgentCommand(
              sessionId,
              confirmedAgent.agentId,
            ));
          }

          return this.buildRoutingResponse(
            confirmedAgent.agentId,
            pending.intention || intention,
            allRules,
            request,
            null,
            planId,
          );
        }
      }
      // Sin sugerencia pendiente → tratar como request genérico
    }

    if (intention === 'reject-suggested' && sessionId) {
      const pending = await this.queryBus.execute(new ConsumePendingNextQuery(sessionId));
      if (pending && projectId) {
        await this.commandBus.execute(new RecordRejectionCommand(
          projectId,
          pending.fromAgentId,
          pending.agentId,
        ));
        this.agentLogger.info(
          this.agentId,
          `❌ [ROUTER] Sugerencia rechazada: ${pending.agentId}`,
        );
      }
      return {
        success: true,
        data: {
          message: 'Entendido. ¿En qué quieres trabajar entonces?',
          intention: 'clarify',
          targetAgent: this.agentId,
        },
        metadata: {
          agentId: this.agentId,
          executionTime: 0,
          timestamp: new Date(),
        },
      };
    }

    // ── Routing normal ───────────────────────────────────────────────────────
    const agentIdFromMap = this.findSpecializedAgentId(intention);

    if (!agentIdFromMap) {
      return {
        success: true,
        data: {
          message:
            '¿Podrías ser más específico? Puedo ayudarte con:\n' +
            '- Generar código (NestJS, Angular)\n' +
            '- Crear issues y user stories\n' +
            '- Análisis de arquitectura\n' +
            '- Historial del proyecto\n' +
            '- Workflow de issues',
          intention,
          targetAgent: this.agentId,
          availableAgents: this.agentRegistry.getAgentIds(),
        },
        metadata: {
          agentId: this.agentId,
          executionTime: 0,
          timestamp: new Date(),
        },
      };
    }

    const targetAgent = this.agentRegistry.getAgent(agentIdFromMap);
    if (!targetAgent) {
      this.agentLogger.warn(
        this.agentId,
        `⚠️ Agente ${agentIdFromMap} no registrado`,
      );
      return {
        success: true,
        data: { message: `Agente ${agentIdFromMap} no disponible.`, intention },
        metadata: {
          agentId: this.agentId,
          executionTime: 0,
          timestamp: new Date(),
        },
      };
    }

    // ── CAPA 1: recordInvocation en agent_session_contexts ───────────────────
    if (sessionId && projectId) {
      const lastAgent = await this.queryBus.execute(new GetLastAgentQuery(sessionId));
      this.commandBus.execute(new RecordInvocationCommand(
        targetAgent.agentId,
        sessionId,
        projectId,
        rawInput,
        `Enrutado por RouterAgent → ${targetAgent.agentId}`,
        allRules.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
        })),
      ))
        .catch(() => {});

      // ── CAPA 2: Registrar transición en agent_invocation_patterns ───────────
      this.commandBus.execute(new RecordTransitionCommand(
        projectId,
        lastAgent,
        targetAgent.agentId,
        intention,
        rawInput,
      ))
        .catch(() => {});

      await this.commandBus.execute(new SetLastAgentCommand(sessionId, targetAgent.agentId));
    }

    // ── CAPA 3: Calcular sugerencia de próximo paso ──────────────────────────
    let suggestedNext: SuggestedNext | null = null;
    if (projectId) {
      suggestedNext = await this.queryBus.execute(new GetSuggestedNextQuery(
        projectId,
        targetAgent.agentId,
      ));
      if (suggestedNext && sessionId) {
        await this.commandBus.execute(new StorePendingNextCommand(
          sessionId,
          suggestedNext,
          targetAgent.agentId,
        ));
      }
    }

    // ── CAPA 5: Crear MCP Plan si es tarea técnica y no hay plan activo ──────
    let activePlanId: string | undefined;
    if (sessionId && this.isTechnicalTask(intention)) {
      try {
        const existing = sessionId
          ? await this.mcpPlanService.findBySession(sessionId)
          : null;
        if (!existing) {
          const title = this.buildPlanTitle(rawInput, intention);
          const plan = await this.mcpPlanService.create({
            title,
            projectId,
            sessionId,
            agentId: targetAgent.agentId,
            plan: {
              summary: rawInput.substring(0, 300),
              detectedIntention: intention,
              steps: [
                {
                  order: 1,
                  description: `Ejecutar ${targetAgent.agentId}`,
                  agentId: targetAgent.agentId,
                  status: 'in_progress',
                },
              ],
              rulesApplied: allRules.map((r) => ({
                id: r.id,
                name: r.name,
                category: r.category,
              })),
              agentsInvolved: [targetAgent.agentId],
            },
          });
          activePlanId = plan.id;
        } else {
          activePlanId = existing.id;
        }
      } catch (error) {
        this.agentLogger.warn(
          this.agentId,
          `⚠️ No se pudo crear plan (routing normal): ${error.message}`,
        );
      }
    }

    return this.buildRoutingResponse(
      targetAgent.agentId,
      intention,
      allRules,
      request,
      suggestedNext,
      activePlanId,
    );
  }

  private buildRoutingResponse(
    targetAgentId: string,
    intention: string,
    allRules: any[],
    request: AgentRequest,
    suggestedNext: SuggestedNext | null,
    planId?: string,
  ): AgentResponse {
    const nextAction = {
      type: 'execute_agent' as const,
      agent: targetAgentId,
      action: 'execute',
      task: request.input,
      context: {
        projectPath: request.options?.projectPath,
        rulesContext: this.formatRulesContext(allRules),
        relevantRules: allRules,
      },
    };

    let message = `Entendido. Ejecutaré el agente **${targetAgentId}** para tu solicitud.`;

    if (suggestedNext) {
      const pct = Math.round(suggestedNext.confidence * 100);
      message +=
        `\n\n💡 **Sugerencia para después** (${pct}% confianza — ${suggestedNext.basedOn}):\n` +
        `→ **${suggestedNext.action}** con \`${suggestedNext.agentId}\`\n` +
        `_Responde "sí" cuando termines para ejecutarlo automáticamente._`;
    }

    const sessionId = request.options?.sessionId;
    const projectId = request.options?.projectId;
    const projectName = request.options?.projectName;

    this.agentLogger.info(
      this.agentId,
      `🚦 [ROUTER] → ${targetAgentId} | intention:${intention} | project:${projectName ?? projectId ?? '-'} | session:${sessionId?.substring(0, 8) ?? '-'} | plan:${planId?.substring(0, 8) ?? '-'}`,
    );

    return {
      success: true,
      data: {
        message,
        targetAgent: targetAgentId,
        intention,
        nextAction,
        planId,
        suggestedNext: suggestedNext ?? undefined,
        relevantRules: allRules.length > 0 ? allRules : undefined,
        rulesContext:
          allRules.length > 0 ? this.formatRulesContext(allRules) : undefined,
      },
      metadata: {
        agentId: this.agentId,
        executionTime: 0,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Automatically searches for relevant code rules
   */
  private async searchRelevantRules(query: string): Promise<any[]> {
    try {
      const url = `${this.rulesApiUrl}?q=${encodeURIComponent(query)}&limit=5`;
      const response = await fetch(url);

      if (!response.ok) {
        this.agentLogger.warn(
          this.agentId,
          `Rules API returned non-OK status: ${response.status}`,
        );
        return [];
      }

      const data = await response.json();
      return data.results?.map((r: any) => r.rule) || [];
    } catch (error) {
      this.agentLogger.error(
        this.agentId,
        `Failed to search rules: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Searches for rules by category (e.g., 'agent', 'frontend')
   * Uses the list endpoint which filters by category directly
   */
  private async searchRelevantRulesByCategory(
    category: string,
  ): Promise<any[]> {
    try {
      const url = `http://localhost:${process.env.PORT || 8004}/rules?category=${category}&limit=20`;
      const response = await fetch(url);

      if (!response.ok) {
        this.agentLogger.warn(
          this.agentId,
          `Rules API returned non-OK status: ${response.status}`,
        );
        return [];
      }

      const data = await response.json();
      return data.rules || [];
    } catch (error) {
      this.agentLogger.error(
        this.agentId,
        `Failed to search rules by category: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Builds system instructions that MUST be followed by specialized agents
   * Includes language, agent rules, and rule IDs for reference
   */
  private buildSystemInstructions(rules: any[], language?: string): string {
    let instructions = '';

    // Language instruction (MANDATORY - at the very beginning)
    const lang = language || 'es';
    if (lang === 'es') {
      instructions += `🌐 **IDIOMA**: You MUST respond entirely in Spanish (español). This is MANDATORY. Do NOT use English except for code blocks, technical terms without Spanish equivalent, or error messages.\n\n`;
    }

    // Agent rules (language, organization, interaction)
    const agentRules = rules.filter((r) => r.category === 'agent');
    if (agentRules.length > 0) {
      instructions += `📋 **AGENT RULES (MUST FOLLOW)**:\n`;
      agentRules.forEach((rule) => {
        instructions += `\n### [ID: ${rule.id}] ${rule.name}\n`;
        // Extract key points from rule content
        const keyPoints = rule.content
          .split('\n')
          .filter(
            (line) =>
              line.includes('✅') ||
              line.includes('❌') ||
              line.includes('**Impact') ||
              line.trim().startsWith('###'),
          )
          .slice(0, 5)
          .join('\n');
        instructions += keyPoints + '\n';
      });
      instructions += '\n---\n\n';
    }

    // Context rules with IDs
    const contextRules = rules.filter((r) => r.category !== 'agent');
    if (contextRules.length > 0) {
      instructions += `📚 **CONTEXT RULES**:\n`;
      contextRules.forEach((rule) => {
        instructions += `- [ID: ${rule.id}] ${rule.name} (${rule.category})\n`;
      });
      instructions += '\n---\n\n';
    }

    return instructions;
  }

  /**
   * Formats rules as a context string for agents
   */
  private formatRulesContext(rules: any[]): string {
    if (rules.length === 0) return '';

    let context = '\n\n📋 **Relevant Code Rules:**\n';
    rules.forEach((rule, i) => {
      context += `\n${i + 1}. **[ID: ${rule.id}] ${rule.name}** (${rule.category} - ${rule.impact})\n`;
      context += `   ${rule.content.substring(0, 200)}${rule.content.length > 200 ? '...' : ''}\n`;
    });

    return context;
  }

  /**
   * Detecta la intención del input del usuario
   */
  private detectIntention(input: string): string {
    const lowerInput = input.toLowerCase();

    // Confirmación de sugerencia pendiente — MÁXIMA PRIORIDAD
    if (
      this.matchesPattern(lowerInput, [
        'sí',
        'ok',
        'okay',
        'adelante',
        'dale',
        'procede',
        'hazlo',
        'confirmo',
        'perfecto',
        'correcto',
        'exacto',
        'venga',
        'vamos',
        'yes',
        'proceed',
        'go ahead',
        'do it',
        'continue',
      ])
    ) {
      return 'confirm-suggested';
    }

    // Rechazo de sugerencia pendiente — MÁXIMA PRIORIDAD
    if (
      this.matchesPattern(lowerInput, [
        'no',
        'nope',
        'no gracias',
        'cancela',
        'para',
        'detente',
        'otro',
        'diferente',
        'cambia',
        'mejor no',
        'skip',
      ])
    ) {
      return 'reject-suggested';
    }

    // Patrones de Graphify - ALTA PRIORIDAD
    if (
      this.matchesPattern(lowerInput, [
        'graphify',
        'grafo de conocimiento',
        'knowledge graph',
        'graphify query',
        'graphify path',
        'graphify explain',
        'construye grafo',
        'construye el grafo',
      ])
    ) {
      return 'graphify';
    }

    // Patrones de Obsidian - ALTA PRIORIDAD
    if (
      this.matchesPattern(lowerInput, [
        'obsidian',
        'segundo cerebro',
        'vault',
        'notas',
        'backlinks',
        'buscar en vault',
        'leer nota',
        'crear nota',
        'escribir nota',
        'lista de notas',
        'listar notas',
      ])
    ) {
      return 'obsidian';
    }

    // Actualización de contexto — ALTA PRIORIDAD (Claude reporta trabajo realizado)
    if (
      this.matchesPattern(lowerInput, [
        'actualizar contexto',
        'actualiza contexto',
        'update context',
        'contexto del proyecto',
        'trabajo realizado',
        'work done',
        'pendiente:',
        'sesión en ',
        'backend (',
        'frontend (',
      ])
    ) {
      return 'context-update';
    }

    // Patrones de historial de proyecto - ALTA PRIORIDAD
    if (
      this.matchesPattern(lowerInput, [
        'historial del proyecto',
        'historial de este proyecto',
        'dame el historial',
        'qué se ha hecho',
        'que se ha hecho',
        'qué hemos trabajado',
        'que hemos trabajado',
        'resumen del proyecto',
        'trabajo anterior',
        'módulos trabajados',
        'modulos trabajados',
        'sessions anteriores',
        'decisiones del proyecto',
        'usa el mcp para cargar el historico',
        'cargar el historico',
        'historial de trabajo',
      ])
    ) {
      return 'project-history';
    }

    // Patrones de Context7 (documentación de librerías) - ALTA PRIORIDAD
    if (
      this.matchesPattern(lowerInput, [
        'context7',
        'use context7',
        'documentación de',
        'documentacion de',
        'docs de',
        'library docs',
        'library documentation',
        'api docs',
        'api documentation',
        'cómo usar',
        'como usar',
        'how to use',
        'properly use',
        'best practices for',
        'best practices',
      ])
    ) {
      return 'context7';
    }

    // Patrones de Product Management (PRIORIDAD ALTA)
    if (
      this.matchesPattern(lowerInput, [
        'crear issue',
        'crear ticket',
        'issue para',
        'ticket para',
        'historia de usuario',
        'user story',
        'como usuario',
        'as a user',
        'criterios de aceptación',
        'acceptance criteria',
        'prd',
        'product requirements',
        'documento de producto',
        'valor de negocio',
        'business value',
      ])
    ) {
      return 'pm';
    }

    // Patrones de issues/workflow
    if (
      this.matchesPattern(lowerInput, [
        'issue',
        'ticket',
        'tarea',
        'task',
        'problema',
        'bug',
        'feature',
        'historia',
        'story',
        'commit',
        'pull request',
        'pr',
        'workflow',
        'iniciar issue',
        'continuar issue',
        'retomar issue',
      ])
    ) {
      return 'issue-workflow';
    }

    // Patrones de búsqueda web (Exa AI)
    if (
      this.matchesPattern(lowerInput, [
        'buscar en',
        'busca en',
        'search on',
        'buscar en google',
        'busca en google',
        'buscar en internet',
        'busca en internet',
        'buscar en la web',
        'busca en la web',
        'web search',
        'internet search',
        'google search',
        'que es',
        'qué es',
        'who is',
        'what is',
        'información sobre',
        'info sobre',
      ])
    ) {
      return 'web-search';
    }

    // Patrones de búsqueda local de reglas
    if (
      this.matchesPattern(lowerInput, [
        'buscar',
        'encuentra',
        'search',
        'qué hay',
        'mostrar reglas',
      ])
    ) {
      return 'search';
    }

    // Patrones de código
    if (
      this.matchesPattern(lowerInput, [
        'crear',
        'crea',
        'generar',
        'genera',
        'código',
        'implementar',
        'implementa',
        'implement',
        'escribe',
        'haz',
        'agrega',
        'agregar',
        'añade',
        'añadir',
        'modifica',
        'modificar',
        'endpoint',
        'service',
        'servicio',
        'componente',
        'component',
        'módulo',
        'modulo',
        'controller',
        'controlador',
      ])
    ) {
      return 'code';
    }

    // Patrones de reglas
    if (
      this.matchesPattern(lowerInput, [
        'regla',
        'reglas',
        'rule',
        'rules',
        'lista',
        'listar',
      ])
    ) {
      return 'rules';
    }

    // Patrones de arquitectura frontend (PRIORIDAD ALTA - antes que analysis)
    if (
      this.matchesPattern(lowerInput, [
        'arquitectura',
        'architecture',
        'estructura',
        'patrón',
        'clean',
        'valida arquitectura',
        'validar arquitectura',
        'valida frontend',
        'validar frontend',
        'frontend architecture',
        'arquitectura frontend',
        'angular architecture',
        'arquitectura angular',
        'analiza el proyecto',
        'analizar el proyecto',
        'analiza proyecto',
        'analizar proyecto',
      ])
    ) {
      return 'frontend-architecture';
    }

    // Patrones de análisis (genérico)
    if (
      this.matchesPattern(lowerInput, [
        'revisa',
        'verifica',
        'revisar',
        'verificar',
      ])
    ) {
      return 'analysis';
    }

    // Patrones de identidad
    if (
      this.matchesPattern(lowerInput, [
        'quién eres',
        'quien eres',
        'identidad',
        'prefijo',
        'mcp',
      ])
    ) {
      return 'identity';
    }

    // Patrones de métricas
    if (
      this.matchesPattern(lowerInput, [
        'métricas',
        'metrics',
        'estadísticas',
        'uso',
        'rendimiento',
      ])
    ) {
      return 'metrics';
    }

    // Por defecto, intentar búsqueda
    return 'search';
  }

  /** Devuelve el agentId del mapa (null si es sentinel __confirm__/__reject__ o no existe) */
  private findSpecializedAgentId(intention: string): string | null {
    const id = this.getAgentMap()[intention];
    if (!id || id.startsWith('__')) return null;
    return id;
  }

  /**
   * Encuentra un agente especializado para la intención dada
   */
  private findSpecializedAgent(intention: string) {
    const agentId = this.findSpecializedAgentId(intention);
    return agentId ? this.agentRegistry.getAgent(agentId) : undefined;
  }

  private getAgentMap(): Record<string, string> {
    return {
      search: 'SearchAgent',
      'web-search': 'WebSearchAgent',
      context7: 'Context7Agent',
      code: 'CodeAgent',
      rules: 'RulesAgent',
      architecture: 'ArchitectureAgent',
      'frontend-architecture': 'FrontendArchitectureAgent',
      analysis: 'AnalysisAgent',
      identity: 'IdentityAgent',
      metrics: 'MetricsAgent',
      'issue-workflow': 'IssueWorkflowAgent',
      pm: 'PMAgent',
      github: 'GitHubAgent',
      git: 'GitHubAgent',
      'project-history': 'ProjectHistoryAgent',
      'context-update': 'ContextAgent',
      graphify: 'GraphifyAgent',
      obsidian: 'ObsidianAgent',
      'confirm-suggested': '__confirm__',
      'reject-suggested': '__reject__',
    };
  }

  /**
   * Verifica si el input coincide con algún patrón
   */
  private matchesPattern(input: string, patterns: string[]): boolean {
    return patterns.some((pattern) => input.includes(pattern));
  }

  /** Intenciones que representan tareas reales — gatillan creación de McpPlan */
  private isTechnicalTask(intention: string): boolean {
    return [
      'code',
      'analysis',
      'architecture',
      'frontend-architecture',
      'issue-workflow',
      'github',
      'search',
      'context',
      'context7',
      'pm',
      'project-history',
      'context-update',
      'graphify',
      'obsidian',
    ].includes(intention);
  }

  /** Genera un título legible para el plan a partir del input y la intención */
  private buildPlanTitle(input: string, intention: string): string {
    const intentionLabel: Record<string, string> = {
      code: 'Implementación',
      analysis: 'Análisis',
      architecture: 'Arquitectura',
      'frontend-architecture': 'Frontend',
      'issue-workflow': 'Workflow',
      github: 'GitHub',
      search: 'Búsqueda',
      context: 'Contexto',
      context7: 'Docs',
    };
    const prefix = intentionLabel[intention] ?? 'Tarea';
    const snippet = input.replace(/\s+/g, ' ').trim().substring(0, 80);
    return `[${prefix}] ${snippet}`;
  }

  /**
   * Registra todos los agentes disponibles en el router
   */
  registerAllAgents(): void {
    const agents = this.agentRegistry.listAgents();
    this.agentLogger.info(this.agentId, 'Agentes disponibles', {
      count: agents.length,
      agents: agents.map((a) => a.agentId),
    });
  }
}
