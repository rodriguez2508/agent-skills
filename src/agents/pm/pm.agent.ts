/**
 * Product Management Agent (PMAgent)
 *
 * Specialized agent for writing product requirements, user stories, and issues
 * from a business/product perspective (NOT technical implementation details).
 *
 * Focus: WHAT and WHY, not HOW
 */

import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest, AgentResponse } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { IssueService } from '@modules/issues/application/services/issue.service';

@Injectable()
export class PMAgent extends BaseAgent {
  constructor(
    private readonly agentLogger: AgentLoggerService,
    private readonly issueService: IssueService,
  ) {
    super(
      'PMAgent',
      'Writes product requirements and user stories from business perspective (PM role)',
    );
  }

  /**
   * Handles product management requests
   * Creates issues, user stories, and requirements from business perspective
   */
  protected async handle(request: AgentRequest): Promise<AgentResponse> {
    const input = request.input;
    const context = request.options?.context;

    this.agentLogger.info(this.agentId, '📋 [PM] Processing product request', {
      input: input.substring(0, 100),
      hasContext: !!context,
    });

    // Detect PM task type
    const taskType = this.detectPMTask(input);

    switch (taskType) {
      case 'CREATE_ISSUE':
        return this.createProductIssue(request);
      case 'USER_STORY':
        return this.createUserStory(request);
      case 'ACCEPTANCE_CRITERIA':
        return this.createAcceptanceCriteria(request);
      case 'PRD':
        return this.createPRD(request);
      default:
        return this.providePMGuidance(request);
    }
  }

  /**
   * Detects what PM task the user wants
   */
  private detectPMTask(input: string): string {
    const lowerInput = input.toLowerCase();

    // Creating issues/tickets
    if (
      this.matchesPattern(lowerInput, [
        'crear issue',
        'crear ticket',
        'create issue',
        'create ticket',
        'necesito un issue',
        'need an issue',
        'abrir issue',
        'open issue',
      ])
    ) {
      return 'CREATE_ISSUE';
    }

    // User stories
    if (
      this.matchesPattern(lowerInput, [
        'historia de usuario',
        'user story',
        'como usuario',
        'as a user',
      ])
    ) {
      return 'USER_STORY';
    }

    // Acceptance criteria
    if (
      this.matchesPattern(lowerInput, [
        'criterios de aceptación',
        'acceptance criteria',
        'definition of done',
      ])
    ) {
      return 'ACCEPTANCE_CRITERIA';
    }

    // Product Requirements Document
    if (
      this.matchesPattern(lowerInput, [
        'prd',
        'product requirements',
        'documento de producto',
      ])
    ) {
      return 'PRD';
    }

    return 'CREATE_ISSUE'; // Default
  }

  /**
   * Creates a product issue (NOT technical!)
   * Focus: Business value, user problem, success metrics
   * ALSO creates issue in database for tracking
   */
  private async createProductIssue(
    request: AgentRequest,
  ): Promise<AgentResponse> {
    const input = request.input;
    const context = request.options?.context || {};
    const userId = request.options?.userId as string;
    const sessionId = request.options?.sessionId as string;

    this.agentLogger.info(this.agentId, '📝 [PM] Creating product issue', {
      feature: input.substring(0, 50),
      userId,
      sessionId,
    });

    // Extract business context
    const businessContext = this.extractBusinessContext(input, context);

    // CREATE ISSUE IN DATABASE
    let issueData: any = {};
    if (userId) {
      try {
        issueData = await this.issueService.createIssue({
          title: this.generatePMTitle(businessContext.feature),
          description: businessContext.currentPainPoint,
          requirements: businessContext.expectedOutcome,
          userId,
          sessionId,
          metadata: {
            autoCreated: true,
            source: 'PMAgent',
            businessValue: this.estimateBusinessValue(businessContext.feature),
          },
        });
      } catch (error) {
        this.agentLogger.warn(
          this.agentId,
          `Failed to create issue in DB: ${error.message}`,
        );
      }
    }

    // Generate issue in PM format (NOT technical!)
    const issue = this.generatePMIssue(businessContext);

    return {
      success: true,
      data: {
        message: '📋 Issue creado desde perspectiva de Producto:',
        issue: {
          ...issue,
          id: issueData.id || null,
          issueId: issueData.issueId || null,
        },
        warning:
          '⚠️ Este issue NO incluye detalles técnicos de implementación. Eso lo define el equipo de desarrollo.',
        nextSteps: [
          'Revisar issue con stakeholders',
          'Priorizar en backlog',
          'El equipo técnico definirá la implementación',
        ],
      },
      metadata: {
        agentId: this.agentId,
        executionTime: 0,
        timestamp: new Date(),
        role: 'Product Manager',
        issueId: issueData.id || null,
        issueCreated: !!issueData.id,
      },
    } as AgentResponse;
  }

  /**
   * Creates a user story
   */
  private async createUserStory(request: AgentRequest): Promise<AgentResponse> {
    const input = request.input;

    const userStory = this.generateUserStory(input);

    return {
      success: true,
      data: {
        message: '📖 Historia de Usuario creada:',
        userStory: {
          format: userStory.format,
          description: userStory.description,
          acceptanceCriteria: userStory.acceptanceCriteria,
        },
      },
    } as AgentResponse;
  }

  /**
   * Creates acceptance criteria
   */
  private async createAcceptanceCriteria(
    request: AgentRequest,
  ): Promise<AgentResponse> {
    const input = request.input;

    const criteria = this.generateAcceptanceCriteria(input);

    return {
      success: true,
      data: {
        message: '✅ Criterios de Aceptación creados:',
        criteria: {
          given: criteria.given,
          when: criteria.when,
          then: criteria.then,
        },
      },
    } as AgentResponse;
  }

  /**
   * Creates Product Requirements Document (PRD)
   */
  private async createPRD(request: AgentRequest): Promise<AgentResponse> {
    const input = request.input;

    const prd = this.generatePRD(input);

    return {
      success: true,
      data: {
        message: '📄 Product Requirements Document (PRD):',
        prd,
      },
    } as AgentResponse;
  }

  /**
   * Provides PM guidance
   */
  private async providePMGuidance(
    request: AgentRequest,
  ): Promise<AgentResponse> {
    return {
      success: true,
      data: {
        message: '🎯 Como Product Manager, puedo ayudarte con:',
        capabilities: [
          'Crear issues enfocados en valor de negocio (NO técnicos)',
          'Escribir historias de usuario (Como [rol], quiero [objetivo], para [beneficio])',
          'Definir criterios de aceptación (Given/When/Then)',
          'Crear Product Requirements Documents (PRD)',
          'Priorizar features por impacto/esfuerzo',
        ],
        example: {
          userSays: 'Necesito un issue para autenticación con Google',
          pmResponse:
            'Issue: "Como usuario, quiero iniciar sesión con Google para acceder más rápido sin crear nueva cuenta"',
          not: 'Issue técnico: "Implementar OAuth2 con Google API usando passport-google-oauth20"',
        },
      },
    } as AgentResponse;
  }

  /**
   * Extracts business context from input
   */
  private extractBusinessContext(input: string, context: any): any {
    return {
      feature: input,
      userProblem: this.identifyUserProblem(input),
      businessGoal: this.identifyBusinessGoal(input, context),
      targetUsers: context.targetUsers || 'Usuarios de la plataforma',
      currentPainPoint: context.currentPainPoint || 'No especificado',
      expectedOutcome:
        context.expectedOutcome || 'Mejora en la experiencia del usuario',
    };
  }

  /**
   * Generates issue in PM format (NOT technical!)
   */
  private generatePMIssue(context: any): any {
    return {
      title: this.generatePMTitle(context.feature),
      description: `## 🎯 Problema del Usuario

${context.userProblem}

## 💼 Objetivo de Negocio

${context.businessGoal}

## 👥 Usuarios Afectados

${context.targetUsers}

## 😓 Punto de Dolor Actual

${context.currentPainPoint}

## ✨ Resultado Esperado

${context.expectedOutcome}`,

      userStory: `**Como** ${this.identifyUserRole(context.feature)}
**Quiero** ${this.identifyUserGoal(context.feature)}
**Para** ${this.identifyUserBenefit(context.feature)}`,

      acceptanceCriteria: this.generateAcceptanceCriteriaList(context.feature),

      businessValue: this.estimateBusinessValue(context.feature),

      successMetrics: [
        '✅ Tasa de adopción > X%',
        '✅ Reducción de tiempo para completar la tarea',
        '✅ Satisfacción del usuario (NPS/CSAT)',
        '✅ Reducción de soporte/tickets relacionados',
      ],

      priority: this.estimatePriority(context.feature),

      labels: this.generateLabels(context.feature),

      outOfScope: [
        '❌ Detalles de implementación técnica',
        '❌ Decisiones de arquitectura',
        '❌ Tecnologías específicas a usar',
      ],

      notes:
        '⚠️ El equipo de desarrollo definirá la solución técnica durante el sprint planning.',
    };
  }

  /**
   * Generates user story in standard format
   */
  private generateUserStory(input: string): any {
    return {
      format: 'Como [rol], quiero [objetivo], para [beneficio]',
      description: `**Como** ${this.identifyUserRole(input)}
**Quiero** ${this.identifyUserGoal(input)}
**Para** ${this.identifyUserBenefit(input)}`,
      acceptanceCriteria: this.generateAcceptanceCriteriaList(input),
    };
  }

  /**
   * Generates acceptance criteria in Given/When/Then format
   */
  private generateAcceptanceCriteria(input: string): any {
    return {
      given: 'Dado que [situación inicial]',
      when: 'Cuando [acción del usuario]',
      then: 'Entonces [resultado esperado]',
      examples: [
        'Dado que soy un usuario no autenticado',
        'Cuando intento acceder a una ruta protegida',
        'Entonces soy redirigido al login con un mensaje',
      ],
    };
  }

  /**
   * Generates PRD structure
   */
  private generatePRD(input: string): any {
    return {
      title: this.generatePMTitle(input),
      problem: 'Descripción del problema que resolvemos',
      goal: 'Objetivo de negocio',
      targetUsers: 'Usuarios objetivo',
      userStories: 'Lista de historias de usuario',
      acceptanceCriteria: 'Criterios de aceptación',
      successMetrics: 'Métricas de éxito',
      outOfScope: 'Qué NO está incluido',
      timeline: 'Timeline estimado',
      dependencies: 'Dependencias con otros equipos/features',
      risks: 'Riesgos identificados',
    };
  }

  // Helper methods

  private identifyUserProblem(input: string): string {
    // Extract user problem from input
    return `Los usuarios necesitan ${input.toLowerCase()}`;
  }

  private identifyBusinessGoal(input: string, context: any): string {
    return (
      context.businessGoal ||
      'Mejorar la experiencia del usuario y aumentar la adopción'
    );
  }

  private identifyUserRole(input: string): string {
    if (input.toLowerCase().includes('admin')) return 'administrador';
    if (
      input.toLowerCase().includes('cliente') ||
      input.toLowerCase().includes('customer')
    )
      return 'cliente';
    return 'usuario';
  }

  private identifyUserGoal(input: string): string {
    // Extract the goal from the input
    return input
      .toLowerCase()
      .replace(/(crear|implementar|agregar|necesito|quiero)/gi, '')
      .trim();
  }

  private identifyUserBenefit(input: string): string {
    const benefits: Record<string, string> = {
      auth: 'acceder de forma segura y rápida',
      login: 'iniciar sesión fácilmente',
      search: 'encontrar lo que busco rápidamente',
      report: 'tener visibilidad del estado',
      export: 'poder usar los datos en otras herramientas',
    };

    for (const [key, benefit] of Object.entries(benefits)) {
      if (input.toLowerCase().includes(key)) return benefit;
    }

    return 'mejorar mi experiencia usando la plataforma';
  }

  private generateAcceptanceCriteriaList(input: string): string[] {
    return [
      '✅ El usuario puede completar la acción principal',
      '✅ Se validan los datos de entrada correctamente',
      '✅ Se muestran mensajes de error claros',
      '✅ Funciona en los navegadores soportados',
      '✅ Cumple con los estándares de accesibilidad',
    ];
  }

  private estimateBusinessValue(input: string): string {
    const highValue = ['auth', 'login', 'payment', 'checkout', 'search'];
    const mediumValue = ['report', 'export', 'dashboard', 'analytics'];
    const lowValue = ['ui', 'style', 'cosmetic', 'minor'];

    const lowerInput = input.toLowerCase();

    if (highValue.some((k) => lowerInput.includes(k))) return '🔴 HIGH';
    if (mediumValue.some((k) => lowerInput.includes(k))) return '🟡 MEDIUM';
    return '🟢 LOW';
  }

  private estimatePriority(input: string): string {
    const urgent = ['bug', 'error', 'fail', 'down', 'broken'];
    const high = ['auth', 'payment', 'security', 'compliance'];

    const lowerInput = input.toLowerCase();

    if (urgent.some((k) => lowerInput.includes(k))) return '🔴 URGENT';
    if (high.some((k) => lowerInput.includes(k))) return '🟠 HIGH';
    return '🟡 MEDIUM';
  }

  private generateLabels(input: string): string[] {
    const labels: string[] = ['feature'];

    if (
      input.toLowerCase().includes('auth') ||
      input.toLowerCase().includes('login')
    ) {
      labels.push('authentication');
    }
    if (
      input.toLowerCase().includes('report') ||
      input.toLowerCase().includes('analytics')
    ) {
      labels.push('analytics');
    }
    if (
      input.toLowerCase().includes('ui') ||
      input.toLowerCase().includes('design')
    ) {
      labels.push('ux/ui');
    }

    return labels;
  }

  private generatePMTitle(feature: string): string {
    // Convert technical feature to business-friendly title
    const titleMap: Record<string, string> = {
      auth: 'Autenticación de Usuarios',
      login: 'Inicio de Sesión',
      oauth: 'Login con Redes Sociales',
      jwt: 'Sistema de Autenticación',
      search: 'Búsqueda en la Plataforma',
      report: 'Reportes y Analytics',
      export: 'Exportación de Datos',
      dashboard: 'Dashboard Principal',
    };

    for (const [key, title] of Object.entries(titleMap)) {
      if (feature.toLowerCase().includes(key)) return title;
    }

    // Default: capitalize first letter
    return feature.charAt(0).toUpperCase() + feature.slice(1);
  }

  private matchesPattern(input: string, patterns: string[]): boolean {
    return patterns.some((pattern) => input.includes(pattern));
  }

  /**
   * Checks if this agent can handle the input
   */
  canHandle(input: string): boolean {
    const pmKeywords = [
      'issue',
      'ticket',
      'historia',
      'story',
      'producto',
      'product',
      'requerimiento',
      'requirement',
      'prd',
      'feature',
      'funcionalidad',
      'criterio',
      'criteria',
      'acceptance',
      'usuario',
      'user story',
      'como usuario',
      'as a user',
      'valor de negocio',
      'business value',
    ];

    return pmKeywords.some((keyword) => input.toLowerCase().includes(keyword));
  }
}
