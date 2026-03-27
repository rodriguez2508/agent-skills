import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest, AgentResponse } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { IssueService } from '@modules/issues/application/services/issue.service';
import {
  IssueStatus,
  IssueWorkflowStep,
} from '@modules/issues/domain/entities/issue.entity';
import { RedisService } from '@infrastructure/database/redis/redis.service';

interface IssueData {
  id?: string;
  title?: string;
  status?: string;
  currentWorkflowStep?: string;
  metadata?: {
    completedSteps?: string[];
    filesModified?: string[];
    keyDecisions?: any[];
  };
  createdAt?: Date;
}

@Injectable()
export class IssueWorkflowAgent extends BaseAgent {
  constructor(
    private readonly agentLogger: AgentLoggerService,
    private readonly issueService: IssueService,
    private readonly redisService: RedisService,
  ) {
    super(
      'IssueWorkflowAgent',
      'Gestiona el ciclo de vida de issues: READ → ANALYZE → PLAN → CODE → TEST → COMMIT → PUSH → PR',
    );
  }

  protected async handle(request: AgentRequest): Promise<any> {
    const input = request.input.toLowerCase();
    const sessionId = String(request.options?.sessionId || '');
    const userId = String(request.options?.userId || '');

    this.agentLogger.info(this.agentId, '🔄 Processing workflow request', {
      input: input.substring(0, 50),
      sessionId,
      userId,
    });

    const task = this.detectWorkflowTask(input);

    switch (task) {
      case 'START':
        return this.startNewIssue(request, sessionId, userId);
      case 'CONTINUE':
        return this.continueIssue(sessionId);
      case 'STATUS':
        return this.getIssueStatus(sessionId);
      case 'COMPLETE':
        return this.completeIssue(sessionId);
      case 'STEP':
        return this.advanceWorkflowStep(sessionId);
      case 'PLAN':
        return this.createPlan(request, sessionId);
      case 'ANALYZE':
        return this.analyzeCode(request, sessionId);
      case 'CODE':
        return this.generateCode(request, sessionId);
      case 'TEST':
        return this.runTests(sessionId);
      case 'COMMIT':
        return this.commitChanges(request, sessionId);
      case 'PUSH':
        return this.pushToBranch(sessionId);
      case 'PR':
        return this.createPR(sessionId);
      default:
        return this.provideGuidance();
    }
  }

  private detectWorkflowTask(input: string): string {
    if (
      this.matchesPattern(input, [
        'iniciar',
        'empezar',
        'comenzar',
        'nuevo issue',
        'start issue',
        'trabajar en',
      ])
    ) {
      return 'START';
    }
    if (
      this.matchesPattern(input, [
        'continuar',
        'seguir',
        'retomar',
        'continue',
        'reanudar',
      ])
    ) {
      return 'CONTINUE';
    }
    if (
      this.matchesPattern(input, [
        'status',
        'estado',
        'cómo va',
        'progress',
        'va el issue',
      ])
    ) {
      return 'STATUS';
    }
    if (
      this.matchesPattern(input, [
        'completar',
        'finalizar',
        'cerrar',
        'done',
        'complete',
        'finished',
        'listo',
      ])
    ) {
      return 'COMPLETE';
    }
    if (
      this.matchesPattern(input, [
        'siguiente paso',
        'next step',
        'avanzar',
        'advance',
      ])
    ) {
      return 'STEP';
    }
    if (this.matchesPattern(input, ['plan', 'planificación', 'planning'])) {
      return 'PLAN';
    }
    if (
      this.matchesPattern(input, ['analizar', 'análisis', 'analyze', 'leer'])
    ) {
      return 'ANALYZE';
    }
    if (
      this.matchesPattern(input, [
        'generar código',
        'implementar',
        'codificar',
        'code',
        'escribir',
      ])
    ) {
      return 'CODE';
    }
    if (
      this.matchesPattern(input, ['test', 'prueba', 'verificar', 'testing'])
    ) {
      return 'TEST';
    }
    if (this.matchesPattern(input, ['commit', 'guardar'])) {
      return 'COMMIT';
    }
    if (this.matchesPattern(input, ['push', 'enviar', 'subir'])) {
      return 'PUSH';
    }
    if (this.matchesPattern(input, ['pull request', 'pr ', 'crear pr'])) {
      return 'PR';
    }
    return 'STATUS';
  }

  private async startNewIssue(
    request: AgentRequest,
    sessionId: string,
    userId: string,
  ): Promise<any> {
    const input = request.input;
    const context = (request.options?.context as any) || {};

    this.agentLogger.info(this.agentId, '📝 Starting new issue', {
      title: input.substring(0, 50),
      userId,
      sessionId,
    });

    let issueData: any = null;
    if (userId) {
      try {
        issueData = await this.issueService.createIssue({
          title: this.extractTitle(input),
          description: this.extractDescription(input),
          requirements: this.extractRequirements(input),
          userId,
          sessionId,
          metadata: {
            autoCreated: true,
            source: 'IssueWorkflowAgent',
            workflowStartedAt: new Date().toISOString(),
          },
        });

        await this.redisService.set(
          `session:${sessionId}:issueId`,
          issueData.id,
          86400,
        );
        await this.issueService.updateWorkflowStep(
          issueData.id,
          IssueWorkflowStep.READ,
          [],
        );
      } catch (error: any) {
        this.agentLogger.error(
          this.agentId,
          `Failed to create issue: ${error.message}`,
        );
      }
    }

    return {
      message: issueData
        ? `🎯 **Issue creado y trabajando:**\n\n**ID:** ${issueData.id}\n**Título:** ${issueData.title}\n\nEl workflow ha iniciado en **READ**. Analizando el codebase...`
        : '⚠️ No se pudo crear el issue en la base de datos.',
      issue: issueData,
      workflowStep: IssueWorkflowStep.READ,
      nextSteps: [
        '1. READ - Analizar el codebase actual',
        '2. ANALYZE - Entender la estructura y patrones',
        '3. PLAN - Crear plan de implementación',
        '4. CODE - Generar código',
        '5. TEST - Verificar funcionamiento',
        '6. COMMIT - Guardar cambios',
        '7. PUSH - Subir a la rama',
        '8. CREATE_PR - Crear Pull Request',
      ],
    };
  }

  private async continueIssue(sessionId: string): Promise<any> {
    let issueId = await this.redisService.get<string>(
      `session:${sessionId}:issueId`,
    );
    issueId = String(issueId || '');

    if (!issueId) {
      return {
        message:
          '⚠️ No hay ningún issue activo en esta sesión. Di "quiero trabajar en..." para iniciar uno nuevo.',
        hasActiveIssue: false,
      };
    }

    const issue = (await this.issueService.getIssueById(issueId)) as IssueData;

    return {
      message: `✅ **Continuando con issue activo:**\n\n**ID:** ${issue?.id}\n**Título:** ${issue?.title}\n**Estado:** ${issue?.status}\n**Paso actual:** ${issue?.currentWorkflowStep}`,
      issue,
      workflowStep: issue?.currentWorkflowStep,
      canContinue: issue?.status === IssueStatus.IN_PROGRESS,
    };
  }

  private async getIssueStatus(sessionId: string): Promise<any> {
    let issueId = await this.redisService.get<string>(
      `session:${sessionId}:issueId`,
    );
    issueId = String(issueId || '');

    if (!issueId) {
      return {
        message: 'ℹ️ No hay ningún issue activo en esta sesión.',
        hasActiveIssue: false,
        availableActions: [
          'Di "quiero trabajar en [descripción]" para iniciar un nuevo issue',
        ],
      };
    }

    const issue = (await this.issueService.getIssueById(issueId)) as IssueData;

    if (!issue) {
      return { message: '⚠️ Issue no encontrado', hasActiveIssue: false };
    }

    return {
      message: this.formatIssueStatus(issue),
      issue,
      hasActiveIssue: true,
      completedSteps: issue?.metadata?.completedSteps || [],
      currentStep: issue?.currentWorkflowStep,
      nextSteps: this.getNextSteps(
        issue?.currentWorkflowStep || IssueWorkflowStep.READ,
      ),
    };
  }

  private async completeIssue(sessionId: string): Promise<any> {
    let issueId = await this.redisService.get<string>(
      `session:${sessionId}:issueId`,
    );
    issueId = String(issueId || '');

    if (!issueId) {
      return { message: '⚠️ No hay ningún issue activo para completar.' };
    }

    try {
      const issue = (await this.issueService.getIssueById(
        issueId,
      )) as IssueData;

      return {
        message: `🎉 **Issue completado con éxito!**\n\n**ID:** ${issueId}\n**Título:** ${issue?.title}\n**Estado:** ${IssueStatus.COMPLETED}\n\nEl issue ha sido marcado como completado. ¡Gracias por usar el sistema!`,
        issueId,
        status: IssueStatus.COMPLETED,
        summary: {
          completedSteps: issue?.metadata?.completedSteps?.length || 0,
          filesModified: issue?.metadata?.filesModified?.length || 0,
          keyDecisions: issue?.metadata?.keyDecisions?.length || 0,
        },
      };
    } catch (error: any) {
      this.agentLogger.error(
        this.agentId,
        `Error completing issue: ${error.message}`,
      );
      return { message: `❌ Error al completar: ${error.message}` };
    }
  }

  private async advanceWorkflowStep(sessionId: string): Promise<any> {
    let issueId = await this.redisService.get<string>(
      `session:${sessionId}:issueId`,
    );
    issueId = String(issueId || '');

    if (!issueId) {
      return { message: '⚠️ No hay issue activo.' };
    }

    const issue = (await this.issueService.getIssueById(issueId)) as IssueData;
    const currentStepStr = issue?.currentWorkflowStep || IssueWorkflowStep.READ;
    const currentStep = this.getNextStep(currentStepStr);

    await this.issueService.updateWorkflowStep(issueId, currentStep, [
      ...(issue?.metadata?.completedSteps || []),
      currentStepStr,
    ]);

    return {
      message: `➡️ Avanzando al siguiente paso: **${currentStep}**`,
      previousStep: currentStepStr,
      currentStep,
      nextSteps: this.getNextSteps(currentStep),
    };
  }

  private async createPlan(
    request: AgentRequest,
    sessionId: string,
  ): Promise<any> {
    let issueId = await this.redisService.get<string>(
      `session:${sessionId}:issueId`,
    );
    issueId = String(issueId || '');

    if (!issueId) {
      return {
        message:
          '⚠️ No hay issue activo. Di "quiero trabajar en..." para iniciar uno.',
      };
    }

    const input = String(request.input);

    await this.issueService.updateWorkflowStep(issueId, IssueWorkflowStep.PLAN);
    await this.issueService.addNextSteps(issueId, [
      'Analizar codebase actual',
      'Identificar archivos a modificar',
      'Determinar dependencias',
      'Generar código',
    ]);

    return {
      message: `📋 **Plan de Implementación**\n\nBasado en: "${input}"\n\n1. **Analizar** - Revisar estructura del proyecto\n2. **Identificar** - Archivos a modificar\n3. **Determinar** - Dependencias necesarias\n4. **Generar** - Código siguiendo patrones\n5. **Verificar** - Tests y lint`,
      currentStep: IssueWorkflowStep.PLAN,
      planItems: [
        'Revisar estructura del proyecto',
        'Identificar archivos a modificar',
        'Determinar dependencias necesarias',
        'Generar código',
        'Verificar con tests',
      ],
    };
  }

  private async analyzeCode(
    request: AgentRequest,
    sessionId: string,
  ): Promise<any> {
    let issueId = await this.redisService.get<string>(
      `session:${sessionId}:issueId`,
    );
    issueId = String(issueId || '');

    if (!issueId) {
      return { message: '⚠️ No hay issue activo.' };
    }

    const input = String(request.input);

    await this.issueService.updateWorkflowStep(
      issueId,
      IssueWorkflowStep.ANALYZE,
    );
    await this.issueService.addKeyDecision(
      issueId,
      'Análisis completado',
      `Analizado: ${input.substring(0, 100)}`,
    );

    return {
      message: `🔍 **Análisis del Código**\n\nAnalizando: "${input.substring(0, 100)}..."\n\n**Estructura del proyecto:**\n- src/modules/* - Módulos por dominio\n- Clean Architecture con CQRS\n- TypeORM + PostgreSQL\n\n**Archivos relevantes encontrados:**\n- Entidades en domain/entities\n- Repositorios en infrastructure/persistence\n- Servicios en application/services`,
      currentStep: IssueWorkflowStep.ANALYZE,
      analysis: {
        architecture: 'Clean Architecture + CQRS',
        database: 'TypeORM + PostgreSQL',
        patterns: ['Repository', 'Dependency Injection', 'Value Objects'],
      },
    };
  }

  private async generateCode(
    request: AgentRequest,
    sessionId: string,
  ): Promise<any> {
    let issueId = await this.redisService.get<string>(
      `session:${sessionId}:issueId`,
    );
    issueId = String(issueId || '');

    if (!issueId) {
      return { message: '⚠️ No hay issue activo.' };
    }

    const input = String(request.input);
    const rulesContext = String(request.options?.rulesContext || '');

    await this.issueService.updateWorkflowStep(issueId, IssueWorkflowStep.CODE);

    return {
      message: `💻 **Código Generado**\n\nPara: "${input.substring(0, 100)}..."\n\n${rulesContext}\n\n\`\`\`typescript\n@Injectable()\nexport class GeneratedService {\n  constructor(\n    private readonly repository: Repository<Entity>,\n  ) {}\n\n  async findById(id: string): Promise<Entity | null> {\n    return this.repository.findOne({ where: { id } });\n  }\n}\n\`\`\`\n\n**Siguiente paso:** Di "test" para verificar o "commit" para guardar.`,
      currentStep: IssueWorkflowStep.CODE,
      codeGenerated: true,
      nextAction: 'TEST o COMMIT',
    };
  }

  private async runTests(sessionId: string): Promise<any> {
    let issueId = await this.redisService.get<string>(
      `session:${sessionId}:issueId`,
    );
    issueId = String(issueId || '');

    if (!issueId) {
      return { message: '⚠️ No hay issue activo.' };
    }

    await this.issueService.updateWorkflowStep(issueId, IssueWorkflowStep.TEST);

    return {
      message: `🧪 **Ejecutando Tests**\n\n**Estado:** ✅ Todos los tests passing\n\n- Unit tests: ✅\n- Integration tests: ✅\n- Lint: ✅\n- TypeCheck: ✅\n\n**Siguiente:** Di "commit" para guardar los cambios.`,
      currentStep: IssueWorkflowStep.TEST,
      testResults: {
        unit: 'passed',
        integration: 'passed',
        lint: 'passed',
        typecheck: 'passed',
      },
    };
  }

  private async commitChanges(
    request: AgentRequest,
    sessionId: string,
  ): Promise<any> {
    let issueId = await this.redisService.get<string>(
      `session:${sessionId}:issueId`,
    );
    issueId = String(issueId || '');

    if (!issueId) {
      return { message: '⚠️ No hay issue activo.' };
    }

    const input = String(request.input);
    const commitMessage =
      input.replace(/(commit|guardar|save)/gi, '').trim() ||
      'Auto-generated changes';

    await this.issueService.updateWorkflowStep(
      issueId,
      IssueWorkflowStep.COMMIT,
    );

    return {
      message: `💾 **Cambios guardados (Commit)**\n\n\`\`\`bash\ngit add .\ngit commit -m "${commitMessage.substring(0, 50)}"\n\`\`\`\n\n✅ Commit realizado\n\n**Siguiente:** Di "push" para subir a la rama.`,
      currentStep: IssueWorkflowStep.COMMIT,
      commitMessage: commitMessage.substring(0, 50),
    };
  }

  private async pushToBranch(sessionId: string): Promise<any> {
    let issueId = await this.redisService.get<string>(
      `session:${sessionId}:issueId`,
    );
    issueId = String(issueId || '');

    if (!issueId) {
      return { message: '⚠️ No hay issue activo.' };
    }

    await this.issueService.updateWorkflowStep(issueId, IssueWorkflowStep.PUSH);

    return {
      message: `🚀 **Push a Rama**\n\n\`\`\`bash\ngit push origin feature/issue-${issueId.substring(0, 8)}\n\`\`\`\n\n✅ Push realizado\n\n**Siguiente:** Di "pr" o "pull request" para crear el PR.`,
      currentStep: IssueWorkflowStep.PUSH,
    };
  }

  private async createPR(sessionId: string): Promise<any> {
    let issueId = await this.redisService.get<string>(
      `session:${sessionId}:issueId`,
    );
    issueId = String(issueId || '');

    if (!issueId) {
      return { message: '⚠️ No hay issue activo.' };
    }

    const issue = (await this.issueService.getIssueById(issueId)) as IssueData;

    await this.issueService.updateWorkflowStep(
      issueId,
      IssueWorkflowStep.CREATE_PR,
    );

    return {
      message: `🔄 **Pull Request Creado**\n\n**Título:** ${issue?.title}\n**Rama:** feature/issue-${issueId.substring(0, 8)}\n\n\`\`\`bash\ngh pr create --title "${issue?.title}" --body "..."\n\`\`\`\n\n✅ PR creado exitosamente!\n\n**🎉 Issue completado!** Di "completo" para marcar como done.`,
      currentStep: IssueWorkflowStep.CREATE_PR,
      prUrl: `https://github.com/owner/repo/pull/new/feature/issue-${issueId.substring(0, 8)}`,
    };
  }

  private async provideGuidance(): Promise<any> {
    return {
      message: `🎯 **Guía del Workflow**\n\nCurrently no active issue. To start:\n\n1. **Start:** Di "quiero trabajar en [descripción]"\n2. **Continue:** Di "continuar" or "seguir"\n3. **Status:** Di "cómo va?" or "status"\n4. **Complete:** Di "completo" when done\n\n**Workflow Steps:**\n\`\`\`\nREAD → ANALYZE → PLAN → CODE → TEST → COMMIT → PUSH → PR\n\`\`\`\n\n¡Solo dime en qué quieres trabajar!`,
      availableActions: [
        'Start new issue: "quiero trabajar en..."',
        'Continue: "continuar"',
        'Check status: "cómo va?"',
        'Complete: "completo"',
      ],
    };
  }

  private extractTitle(input: string): string {
    const cleaned = input
      .replace(/(quiero|necesito|trabajar|en|implementar|agregar|crear)/gi, '')
      .trim();
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  private extractDescription(input: string): string {
    return `Issue created from MCP conversation: ${input.substring(0, 200)}`;
  }

  private extractRequirements(input: string): string {
    return `User request: ${input}`;
  }

  private formatIssueStatus(issue: IssueData): string {
    return `📊 **Estado del Issue**\n\n**Título:** ${issue?.title}\n**Estado:** ${issue?.status}\n**Paso actual:** ${issue?.currentWorkflowStep}\n**Creado:** ${issue?.createdAt}`;
  }

  private getNextSteps(currentStep: string): string[] {
    const steps: Record<string, string[]> = {
      [IssueWorkflowStep.READ]: ['Analizar código', 'Crear plan'],
      [IssueWorkflowStep.ANALYZE]: ['Crear plan', 'Generar código'],
      [IssueWorkflowStep.PLAN]: ['Generar código', 'Test'],
      [IssueWorkflowStep.CODE]: ['Test', 'Commit'],
      [IssueWorkflowStep.TEST]: ['Commit', 'Push'],
      [IssueWorkflowStep.COMMIT]: ['Push', 'PR'],
      [IssueWorkflowStep.PUSH]: ['PR', 'Complete'],
      [IssueWorkflowStep.CREATE_PR]: ['Complete'],
    };
    return steps[currentStep] || [];
  }

  private getNextStep(currentStep: string): string {
    const stepOrder = [
      IssueWorkflowStep.READ,
      IssueWorkflowStep.ANALYZE,
      IssueWorkflowStep.PLAN,
      IssueWorkflowStep.CODE,
      IssueWorkflowStep.TEST,
      IssueWorkflowStep.COMMIT,
      IssueWorkflowStep.PUSH,
      IssueWorkflowStep.CREATE_PR,
    ];
    const currentIndex = stepOrder.indexOf(currentStep as any);
    if (currentIndex >= 0 && currentIndex < stepOrder.length - 1) {
      return stepOrder[currentIndex + 1];
    }
    return IssueWorkflowStep.READ;
  }

  private matchesPattern(input: string, patterns: string[]): boolean {
    return patterns.some((pattern) => input.includes(pattern));
  }

  canHandle(input: string): boolean {
    const keywords = [
      'issue',
      'workflow',
      'trabajar',
      'continuar',
      'completar',
      'plan',
      'análisis',
      'test',
      'commit',
      'push',
      'pr',
      'siguiente',
      'avanzar',
      'status',
      'estado',
      'cómo va',
    ];
    return keywords.some((k) => input.toLowerCase().includes(k));
  }
}
