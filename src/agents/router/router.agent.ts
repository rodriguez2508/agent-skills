import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest, AgentResponse } from '@core/agents/agent-response';
import { AgentRegistry } from '@core/agents/agent-registry';
import {
  AgentLoggerService,
  LogLevel,
} from '@infrastructure/logging/agent-logger.service';

/**
 * RouterAgent - Orquestador principal de agentes
 * Detecta la intención del usuario y enruta al agente especializado
 * Automatically searches for relevant code rules on every request
 */
@Injectable()
export class RouterAgent extends BaseAgent {
  private readonly rulesApiUrl: string;

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly agentLogger: AgentLoggerService,
  ) {
    super(
      'RouterAgent',
      'Orquesta y enruta solicitudes a los agentes especializados',
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
    const systemInstructions = this.buildSystemInstructions(allRules, request.options?.language);

    // Prepend system instructions to the input
    const finalInput = systemInstructions + request.input;

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

    // Detectar intención
    const intention = this.detectIntention(request.input);

    this.agentLogger.info(
      this.agentId,
      `🧠 [ROUTER] Intención detectada: ${intention}`,
      {
        confidence: 'high',
        inputPreview: request.input.substring(0, 50),
      },
    );

    // Encontrar agente especializado
    const targetAgent = this.findSpecializedAgent(intention);

    if (!targetAgent) {
      this.agentLogger.warn(
        this.agentId,
        `⚠️ [ROUTER] No se encontró agente especializado para: ${intention}`,
        {
          availableAgents: this.agentRegistry.getAgentIds(),
        },
      );

      // Si no hay agente especializado, devolver respuesta genérica
      return {
        success: true,
        data: {
          message:
            "I understand you're asking about something. Could you be more specific? I can help you with:\n" +
            '- Searching code rules (Clean Architecture, CQRS, NestJS)\n' +
            '- Generating code\n' +
            '- Explaining architecture patterns\n' +
            '- Analyzing code quality\n' +
            '- Product Management (creating issues, user stories)\n' +
            '- Issue workflow tracking',
          intention,
          targetAgent: this.agentId,
          availableAgents: this.agentRegistry.getAgentIds(),
          relevantRules: allRules.length > 0 ? allRules : undefined,
        },
        metadata: {
          agentId: this.agentId,
          executionTime: 0,
          timestamp: new Date(),
        },
      };
    }

    this.agentLogger.info(
      this.agentId,
      `🔀 [ROUTER] Enrutando a ${targetAgent.agentId}`,
      {
        from: this.agentId,
        to: targetAgent.agentId,
        intention,
      },
    );

    // Execute specialized agent (system instructions already prepended to input)
    this.agentLogger.info(
      targetAgent.agentId,
      `▶️ [EXEC] Ejecutando agente especializado`,
      {
        request: request.input.substring(0, 100),
      },
    );

    const response = await targetAgent.execute(request);

    this.agentLogger.info(
      this.agentId,
      `📤 [ROUTER] Respuesta recibida de ${targetAgent.agentId}`,
      {
        success: response.success,
        executionTime: response.metadata?.executionTime,
        hasError: !!response.error,
      },
    );

    // Retornar respuesta con contexto de enrutamiento y reglas
    return {
      ...response,
      data: {
        ...response.data,
        routedBy: this.agentId,
        targetAgent: targetAgent.agentId,
        intention,
        relevantRules: allRules.length > 0 ? allRules : undefined,
        rulesContext:
          allRules.length > 0
            ? this.formatRulesContext(allRules)
            : undefined,
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
  private async searchRelevantRulesByCategory(category: string): Promise<any[]> {
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
    const agentRules = rules.filter(r => r.category === 'agent');
    if (agentRules.length > 0) {
      instructions += `📋 **AGENT RULES (MUST FOLLOW)**:\n`;
      agentRules.forEach(rule => {
        instructions += `\n### [ID: ${rule.id}] ${rule.name}\n`;
        // Extract key points from rule content
        const keyPoints = rule.content
          .split('\n')
          .filter(line => line.includes('✅') || line.includes('❌') || line.includes('**Impact') || line.trim().startsWith('###'))
          .slice(0, 5)
          .join('\n');
        instructions += keyPoints + '\n';
      });
      instructions += '\n---\n\n';
    }

    // Context rules with IDs
    const contextRules = rules.filter(r => r.category !== 'agent');
    if (contextRules.length > 0) {
      instructions += `📚 **CONTEXT RULES**:\n`;
      contextRules.forEach(rule => {
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
        'configure',
        'configurar',
        'setup',
        'set up',
        'implementar',
        'implement',
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
        'generar',
        'código',
        'implementar',
        'escribe',
        'haz',
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

  /**
   * Encuentra un agente especializado para la intención dada
   */
  private findSpecializedAgent(intention: string) {
    const agentMap: Record<string, string> = {
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
    };

    const targetAgentId = agentMap[intention];

    if (!targetAgentId) {
      return undefined;
    }

    return this.agentRegistry.getAgent(targetAgentId);
  }

  /**
   * Verifica si el input coincide con algún patrón
   */
  private matchesPattern(input: string, patterns: string[]): boolean {
    return patterns.some((pattern) => input.includes(pattern));
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
