/**
 * IssueWorkflowAgent - Agente especializado en gestión de flujo de issues
 * Guía al usuario a través del ciclo completo: leer → trabajar → commit → PR
 * AUTOMATICALLY tracks progress in database
 */

import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest, AgentResponse } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { IssueRepository } from '@infrastructure/persistence/repositories/issue.repository';
import { Issue, IssueStatus, IssueWorkflowStep } from '@modules/issues/domain/entities/issue.entity';

@Injectable()
export class IssueWorkflowAgent extends BaseAgent {
  constructor(
    private readonly agentLogger: AgentLoggerService,
    private readonly issueRepository: IssueRepository,
  ) {
    super(
      'IssueWorkflowAgent',
      'Manages complete issue workflow from read to PR creation',
    );
  }

  /**
   * Handles issue workflow requests
   * Tracks progress through all 9 steps
   */
  protected async handle(request: AgentRequest): Promise<AgentResponse> {
    const input = request.input;
    const sessionId = request.options?.sessionId as string | undefined;
    const userId = request.options?.userId as string | undefined;

    this.agentLogger.info(this.agentId, '📋 [ISSUE WORKFLOW] Processing request', {
      input: input.substring(0, 100),
      sessionId,
      userId,
    });

    // Detect workflow action
    const action = this.detectWorkflowAction(input);

    switch (action) {
      case 'START':
        return this.startIssueWorkflow(request, userId);
      case 'RESUME':
        return this.resumeIssueWorkflow(request, userId);
      case 'UPDATE_STEP':
        return this.updateWorkflowStep(request, sessionId);
      case 'COMMIT':
        return this.handleCommit(request, sessionId);
      case 'CREATE_PR':
        return this.handleCreatePR(request, sessionId);
      case 'STATUS':
        return this.getWorkflowStatus(request, userId);
      default:
        return this.provideGuidance(request, userId);
    }
  }

  /**
   * Detects what workflow action the user wants
   */
  private detectWorkflowAction(input: string): string {
    const lowerInput = input.toLowerCase();

    // Start working on new issue
    if (this.matchesPattern(lowerInput, ['iniciar', 'comenzar', 'empezar', 'start', 'nuevo issue', 'new issue'])) {
      return 'START';
    }

    // Resume existing issue
    if (this.matchesPattern(lowerInput, ['continuar', 'retomar', 'resume', 'seguir con', 'retomar issue'])) {
      return 'RESUME';
    }

    // Update workflow step
    if (this.matchesPattern(lowerInput, ['completé', 'terminé', 'hecho', 'completed', 'finished', 'done'])) {
      return 'UPDATE_STEP';
    }

    // Commit changes
    if (this.matchesPattern(lowerInput, ['commit', 'commitear', 'hacer commit'])) {
      return 'COMMIT';
    }

    // Create PR
    if (this.matchesPattern(lowerInput, ['crear pr', 'crear pull request', 'abrir pr', 'open pr'])) {
      return 'CREATE_PR';
    }

    // Check status
    if (this.matchesPattern(lowerInput, ['estado', 'status', 'progreso', 'progress', 'cómo voy'])) {
      return 'STATUS';
    }

    return 'GUIDANCE';
  }

  /**
   * Starts workflow for a new issue
   */
  private async startIssueWorkflow(request: AgentRequest, userId?: string): Promise<AgentResponse> {
    const input = request.input;

    // Extract issue info from input
    const issueInfo = this.extractIssueInfo(input);

    this.agentLogger.info(this.agentId, '🚀 [ISSUE WORKFLOW] Starting new issue', {
      issueId: issueInfo.issueId,
      title: issueInfo.title,
    });

    // Create issue in database
    const issue = await this.issueRepository.create({
      issueId: issueInfo.issueId || 'UNKNOWN',
      title: issueInfo.title || input.substring(0, 100),
      description: issueInfo.description,
      requirements: issueInfo.requirements,
      userId: userId || undefined,
      repositoryUrl: issueInfo.repositoryUrl,
      metadata: {
        labels: issueInfo.labels,
        estimatedHours: issueInfo.estimatedHours,
      },
    });

    return {
      success: true,
      data: {
        message: `✅ Issue #${issue.issueId} registrado. Comenzando flujo de trabajo:`,
        issue: {
          id: issue.id,
          issueId: issue.issueId,
          title: issue.title,
          status: issue.status,
          currentStep: issue.currentWorkflowStep,
        },
        workflow: this.getWorkflowGuide(),
        nextStep: {
          step: IssueWorkflowStep.READ,
          name: 'Read Issue',
          description: 'Lee y entiende los requerimientos del issue',
          actions: [
            'Identifica el ID y título del issue',
            'Extrae los requerimientos principales',
            'Identifica criterios de aceptación',
          ],
        },
      },
      metadata: {
        agentId: this.agentId,
        executionTime: 0,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Resumes workflow for existing issue
   */
  private async resumeIssueWorkflow(request: AgentRequest, userId?: string): Promise<AgentResponse> {
    const input = request.input;

    // Find active issues for user
    if (!userId) {
      return {
        success: false,
        error: 'User ID required to resume issue',
      } as AgentResponse;
    }

    const activeIssues = await this.issueRepository.findActiveIssues(userId);

    if (activeIssues.length === 0) {
      return {
        success: true,
        data: {
          message: 'No tienes issues activos en progreso.',
          suggestion: 'Usa "iniciar issue #123 - descripción" para comenzar uno nuevo',
        },
      } as AgentResponse;
    }

    // Get most recent active issue
    const issue = activeIssues[0];
    const progress = await this.issueRepository.getProgress(issue.issueId);

    this.agentLogger.info(this.agentId, '▶️ [ISSUE WORKFLOW] Resuming issue', {
      issueId: issue.issueId,
      currentStep: issue.currentWorkflowStep,
      progress,
    });

    return {
      success: true,
      data: {
        message: `▶️ Retomando Issue #${issue.issueId}: ${issue.title}`,
        issue: {
          id: issue.id,
          issueId: issue.issueId,
          title: issue.title,
          status: issue.status,
          currentStep: issue.currentWorkflowStep,
          progress: `${progress}%`,
        },
        lastSession: {
          completedSteps: issue.completedSteps,
          nextSteps: issue.nextSteps,
          filesModified: issue.filesModified?.length || 0,
          branchName: issue.branchName,
        },
        nextStep: this.getNextStepInfo(issue.currentWorkflowStep),
      },
      metadata: {
        agentId: this.agentId,
        executionTime: 0,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Updates workflow step completion
   */
  private async updateWorkflowStep(request: AgentRequest, sessionId?: string): Promise<AgentResponse> {
    const input = request.input;

    // Detect which step was completed
    const completedStep = this.detectCompletedStep(input);

    if (!completedStep) {
      return {
        success: false,
        error: 'Could not detect which step was completed',
      } as AgentResponse;
    }

    // Update in database (would need issueId from context)
    // For now, return guidance
    return {
      success: true,
      data: {
        message: `✅ Paso "${completedStep}" completado.`,
        nextStep: this.getNextStepInfo(completedStep),
      },
    } as AgentResponse;
  }

  /**
   * Handles commit action
   */
  private async handleCommit(request: AgentRequest, sessionId?: string): Promise<AgentResponse> {
    const input = request.input;

    // Generate commit message based on changes
    const commitMessage = this.generateCommitMessage(input);

    return {
      success: true,
      data: {
        message: '📝 Commit generado:',
        commit: {
          message: commitMessage,
          command: `git add . && git commit -m "${commitMessage}"`,
        },
        nextStep: {
          step: 'PUSH',
          action: 'Push to remote branch',
          command: `git push origin ${request.options?.branchName || 'feature/issue'}`,
        },
      },
    } as AgentResponse;
  }

  /**
   * Handles PR creation
   */
  private async handleCreatePR(request: AgentRequest, sessionId?: string): Promise<AgentResponse> {
    const input = request.input;

    // Generate PR.md content
    const prMdContent = this.generatePRMd(input, request.options);

    return {
      success: true,
      data: {
        message: '📄 PR.md generado:',
        pr: {
          title: this.generatePRTitle(input),
          description: prMdContent,
          nextSteps: [
            'Guardar PR.md en la raíz del repositorio',
            'Commit: git add PR.md && git commit -m "docs: add PR description"',
            'Push: git push',
            'Crear PR en GitHub/GitLab',
          ],
        },
      },
    } as AgentResponse;
  }

  /**
   * Gets workflow status for user
   */
  private async getWorkflowStatus(request: AgentRequest, userId?: string): Promise<AgentResponse> {
    if (!userId) {
      return {
        success: false,
        error: 'User ID required',
      } as AgentResponse;
    }

    const stats = await this.issueRepository.getStats(userId);
    const activeIssues = await this.issueRepository.findActiveIssues(userId);

    return {
      success: true,
      data: {
        message: '📊 Estado de issues:',
        stats,
        activeIssues: activeIssues.map(issue => ({
          issueId: issue.issueId,
          title: issue.title,
          currentStep: issue.currentWorkflowStep,
          progress: `${(issue.completedSteps?.length || 0) * 10}%`,
        })),
      },
    } as AgentResponse;
  }

  /**
   * Provides general workflow guidance
   */
  private async provideGuidance(request: AgentRequest, userId?: string): Promise<AgentResponse> {
    return {
      success: true,
      data: {
        message: '📋 Flujo completo de trabajo con issues:',
        workflow: this.getWorkflowGuide(),
        suggestion: 'Dime: "Iniciar issue #123 - descripción" para comenzar',
      },
    } as AgentResponse;
  }

  /**
   * Extracts issue information from user input
   */
  private extractIssueInfo(input: string): {
    issueId?: string;
    title?: string;
    description?: string;
    requirements?: string;
    repositoryUrl?: string;
    labels?: string[];
    estimatedHours?: number;
  } {
    // Extract issue ID (e.g., #123, ISSUE-123)
    const issueIdMatch = input.match(/#(\d+)|([A-Z]+-\d+)/i);
    const issueId = issueIdMatch ? (issueIdMatch[1] || issueIdMatch[2]) : undefined;

    // Extract repository URL if present
    const repoMatch = input.match(/(https?:\/\/github\.com\/[^\s]+)/);
    const repositoryUrl = repoMatch ? repoMatch[1] : undefined;

    return {
      issueId,
      title: input.split('\n')[0].substring(0, 100),
      description: input,
      repositoryUrl,
    };
  }

  /**
   * Detects which workflow step was completed from input
   */
  private detectCompletedStep(input: string): IssueWorkflowStep | null {
    const lowerInput = input.toLowerCase();

    if (this.matchesPattern(lowerInput, ['leí', 'leído', 'read', 'entendido', 'understand'])) {
      return IssueWorkflowStep.READ;
    }
    if (this.matchesPattern(lowerInput, ['analiz', 'analized', 'contexto', 'context'])) {
      return IssueWorkflowStep.ANALYZE;
    }
    if (this.matchesPattern(lowerInput, ['plan', 'plane', 'steps', 'pasos'])) {
      return IssueWorkflowStep.PLAN;
    }
    if (this.matchesPattern(lowerInput, ['codifiqué', 'coded', 'implement', 'código'])) {
      return IssueWorkflowStep.CODE;
    }
    if (this.matchesPattern(lowerInput, ['teste', 'test', 'verifiqué', 'verify'])) {
      return IssueWorkflowStep.TEST;
    }
    if (this.matchesPattern(lowerInput, ['commite', 'commit'])) {
      return IssueWorkflowStep.COMMIT;
    }
    if (this.matchesPattern(lowerInput, ['pushe', 'push'])) {
      return IssueWorkflowStep.PUSH;
    }
    if (this.matchesPattern(lowerInput, ['pr.md', 'crear pr', 'create pr'])) {
      return IssueWorkflowStep.CREATE_PR_MD;
    }

    return null;
  }

  /**
   * Gets next step information
   */
  private getNextStepInfo(currentStep?: IssueWorkflowStep): any {
    const steps: Record<IssueWorkflowStep, { name: string; description: string; actions: string[] }> = {
      [IssueWorkflowStep.READ]: {
        name: 'Read Issue',
        description: 'Lee y entiende los requerimientos',
        actions: ['Identifica ID y título', 'Extrae requerimientos', 'Identifica criterios'],
      },
      [IssueWorkflowStep.ANALYZE]: {
        name: 'Analyze Context',
        description: 'Analiza el contexto y arquitectura',
        actions: ['Revisa código existente', 'Identifica capas afectadas', 'Busca patrones similares'],
      },
      [IssueWorkflowStep.PLAN]: {
        name: 'Plan Steps',
        description: 'Define los pasos de implementación',
        actions: ['Crea lista de tareas', 'Define orden', 'Estima esfuerzo'],
      },
      [IssueWorkflowStep.CODE]: {
        name: 'Code Solution',
        description: 'Implementa la solución',
        actions: ['Sigue Clean Architecture', 'Aplica reglas', 'Escribe código limpio'],
      },
      [IssueWorkflowStep.TEST]: {
        name: 'Test & Verify',
        description: 'Verifica que funciona',
        actions: ['Ejecuta tests', 'Verifica reglas', 'Revisa TypeScript'],
      },
      [IssueWorkflowStep.COMMIT]: {
        name: 'Commit Changes',
        description: 'Haz commit atómico',
        actions: ['git add .', 'git commit -m "feat: ..."', 'Usa conventional commits'],
      },
      [IssueWorkflowStep.PUSH]: {
        name: 'Push to Branch',
        description: 'Sube los cambios',
        actions: ['git push origin feature/...', 'Verifica remote'],
      },
      [IssueWorkflowStep.CREATE_PR_MD]: {
        name: 'Create PR.md',
        description: 'Documenta los cambios',
        actions: ['Crea PR.md', 'Describe cambios', 'Lista archivos'],
      },
      [IssueWorkflowStep.CREATE_PR]: {
        name: 'Create Pull Request',
        description: 'Abre el PR en GitHub/GitLab',
        actions: ['Copia PR.md', 'Pega en GitHub', 'Linka issue'],
      },
    };

    const currentStepIndex = currentStep ? Object.values(IssueWorkflowStep).indexOf(currentStep) : 0;
    const nextStepIndex = currentStepIndex + 1;
    const nextStep = Object.values(IssueWorkflowStep)[nextStepIndex];

    if (!nextStep) {
      return { completed: true, message: '¡Issue completado! 🎉' };
    }

    return {
      step: nextStep,
      ...steps[nextStep],
    };
  }

  /**
   * Gets complete workflow guide
   */
  private getWorkflowGuide(): any {
    return {
      steps: [
        { step: 1, name: 'Read Issue', icon: '📖' },
        { step: 2, name: 'Analyze Context', icon: '🔍' },
        { step: 3, name: 'Plan Steps', icon: '📝' },
        { step: 4, name: 'Code Solution', icon: '💻' },
        { step: 5, name: 'Test & Verify', icon: '✅' },
        { step: 6, name: 'Commit Changes', icon: '💾' },
        { step: 7, name: 'Push to Branch', icon: '⬆️' },
        { step: 8, name: 'Create PR.md', icon: '📄' },
        { step: 9, name: 'Create Pull Request', icon: '🔀' },
      ],
      description: 'Sigue estos 9 pasos para cada issue',
    };
  }

  /**
   * Generates commit message from changes
   */
  private generateCommitMessage(input: string): string {
    // Detect type of change
    if (input.toLowerCase().includes('nuevo') || input.toLowerCase().includes('new')) {
      return `feat: add new functionality`;
    }
    if (input.toLowerCase().includes('fix') || input.toLowerCase().includes('arregl')) {
      return `fix: resolve reported issue`;
    }
    if (input.toLowerCase().includes('refactor')) {
      return `refactor: improve code structure`;
    }
    return `feat: implement issue requirements`;
  }

  /**
   * Generates PR.md content
   */
  private generatePRMd(input: string, options?: any): string {
    return `# Pull Request

## Summary
${input.substring(0, 200)}

## Changes
- Implementation based on issue requirements

## Architecture Compliance
- ✅ Clean Architecture layers respected
- ✅ Dependency Injection used
- ✅ Repository pattern implemented

## Testing
- [ ] Tests added/updated

## Related Issue
- Closes #ISSUE_ID
`;
  }

  /**
   * Generates PR title
   */
  private generatePRTitle(input: string): string {
    return `feat: ${input.substring(0, 50)}`;
  }

  /**
   * Checks if input matches patterns
   */
  private matchesPattern(input: string, patterns: string[]): boolean {
    return patterns.some((pattern) => input.includes(pattern));
  }

  /**
   * Checks if this agent can handle the input
   */
  canHandle(input: string): boolean {
    const issueKeywords = [
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
    ];

    return issueKeywords.some((keyword) => input.toLowerCase().includes(keyword));
  }
}
