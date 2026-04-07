import { Injectable, Logger } from '@nestjs/common';
import { AgentRegistry } from '@core/agents/agent-registry';
import { AgentRequest, AgentResponse } from '@core/agents/agent-response';

/**
 * Contexto de ejecución del workflow
 */
export interface WorkflowContext {
  /**
   * Input original del usuario
   */
  userInput: string;

  /**
   * ID del proyecto (opcional)
   */
  projectId?: string;

  /**
   * ID del usuario (opcional)
   */
  userId?: string;

  /**
   * ID del issue (opcional)
   */
  issueId?: string;

  /**
   * Respuestas previas de agentes
   */
  previousResponses: Record<string, AgentResponse>;

  /**
   * Metadata adicional
   */
  metadata: Record<string, any>;
}

/**
 * Paso individual de un workflow
 */
export interface WorkflowStep {
  /**
   * ID del agente a ejecutar
   */
  agentId: string;

  /**
   * Orden de ejecución (menor = primero)
   */
  order: number;

  /**
   * Si es true, se ejecuta en paralelo con otros pasos del mismo orden
   */
  parallel?: boolean;

  /**
   * Condición opcional para ejecutar este paso
   */
  condition?: (context: WorkflowContext) => boolean;
}

/**
 * WorkflowEngine - Orquestador de agentes especializados
 *
 * Ejecuta workflows definidos como secuencias de pasos de agentes.
 * Soporta ejecución secuencial y paralela.
 *
 * @example
 * // Workflow de análisis de proyecto
 * const workflow: WorkflowStep[] = [
 *   { agentId: 'AnalysisAgent', order: 1 },
 *   { agentId: 'ArchitectureAgent', order: 1, parallel: true },
 *   { agentId: 'MetricsAgent', order: 1, parallel: true },
 *   { agentId: 'RulesAgent', order: 2 },
 * ];
 *
 * const results = await workflowEngine.executeWorkflow(workflow, context);
 */
@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);

  constructor(private readonly agentRegistry: AgentRegistry) {}

  /**
   * Ejecuta un workflow definido
   *
   * @param steps - Pasos del workflow
   * @param context - Contexto de ejecución
   * @returns Resultados de cada agente ejecutado
   */
  async executeWorkflow(
    steps: WorkflowStep[],
    context: WorkflowContext,
  ): Promise<Record<string, AgentResponse>> {
    this.logger.log(
      `🔄 Starting workflow execution | Steps: ${steps.length} | Input: "${context.userInput.substring(0, 50)}..."`,
    );

    const results: Record<string, AgentResponse> = {};
    const startTime = Date.now();

    // Agrupar steps por orden
    const stepsByOrder = steps.reduce(
      (acc, step) => {
        if (!acc[step.order]) {
          acc[step.order] = [];
        }
        acc[step.order].push(step);
        return acc;
      },
      {} as Record<number, WorkflowStep[]>,
    );

    // Ejecutar órdenes secuencialmente
    const orders = Object.keys(stepsByOrder)
      .map(Number)
      .sort((a, b) => a - b);

    this.logger.log(`📋 Execution order: ${orders.join(' → ')}`);

    for (const order of orders) {
      const currentSteps = stepsByOrder[order];
      this.logger.log(
        `⚙️ Executing order ${order} with ${currentSteps.length} step(s)`,
      );

      // Separar paralelos y secuenciales
      const parallelSteps = currentSteps.filter((s) => s.parallel);
      const sequentialSteps = currentSteps.filter((s) => !s.parallel);

      // Ejecutar paralelos
      if (parallelSteps.length > 0) {
        this.logger.log(
          `🚀 Executing ${parallelSteps.length} parallel step(s)`,
        );
        const parallelResults = await this.executeParallel(
          parallelSteps,
          context,
          results,
        );
        Object.assign(results, parallelResults);
      }

      // Ejecutar secuenciales
      for (const step of sequentialSteps) {
        if (step.condition && !step.condition(context)) {
          this.logger.log(`⏭️ Skipping ${step.agentId} (condition not met)`);
          continue; // Saltar si no cumple condición
        }

        this.logger.log(`▶️ Executing ${step.agentId} (sequential)`);
        const result = await this.executeAgent(step.agentId, context);
        results[step.agentId] = result;

        // Actualizar contexto con respuesta
        context.previousResponses[step.agentId] = result;

        // Log resultado
        this.logger.log(
          `✅ ${step.agentId} completed | Success: ${result.success} | Time: ${result.metadata?.executionTime}ms`,
        );
      }
    }

    const totalTime = Date.now() - startTime;
    this.logger.log(
      `🏁 Workflow completed | Total time: ${totalTime}ms | Agents executed: ${Object.keys(results).length}`,
    );

    return results;
  }

  /**
   * Ejecuta agentes en paralelo
   */
  private async executeParallel(
    steps: WorkflowStep[],
    context: WorkflowContext,
    previousResults: Record<string, AgentResponse>,
  ): Promise<Record<string, AgentResponse>> {
    const executions = steps.map(async (step) => {
      if (step.condition && !step.condition(context)) {
        this.logger.log(
          `⏭️ Skipping ${step.agentId} (parallel, condition not met)`,
        );
        return null;
      }

      this.logger.log(`🚀 Executing ${step.agentId} (parallel)`);
      const result = await this.executeAgent(step.agentId, context);
      return { agentId: step.agentId, result };
    });

    const results = await Promise.all(executions);

    return results.reduce(
      (acc, r) => {
        if (r) {
          acc[r.agentId] = r.result;
          this.logger.log(
            `✅ ${r.agentId} completed (parallel) | Success: ${r.result.success}`,
          );
        }
        return acc;
      },
      {} as Record<string, AgentResponse>,
    );
  }

  /**
   * Ejecuta un agente específico
   */
  private async executeAgent(
    agentId: string,
    context: WorkflowContext,
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    const agent = this.agentRegistry.getAgent(agentId);

    if (!agent) {
      this.logger.error(`❌ Agent ${agentId} not found in registry`);
      return {
        success: false,
        error: `Agent ${agentId} not found`,
        metadata: {
          agentId,
          executionTime: 0,
          timestamp: new Date(),
        },
      };
    }

    // Construir request para el agente
    const request: AgentRequest = {
      input: context.userInput,
      options: {
        projectId: context.projectId,
        userId: context.userId,
        issueId: context.issueId,
        previousResponses: context.previousResponses,
        workflowContext: context,
        ...context.metadata,
      },
    };

    this.logger.log(
      `📤 Sending request to ${agentId} | Input length: ${request.input.length}`,
    );

    try {
      const response = await agent.execute(request);
      const executionTime = Date.now() - startTime;

      return {
        ...response,
        metadata: {
          ...response.metadata,
          agentId,
          executionTime,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`❌ Agent ${agentId} failed | Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
        metadata: {
          agentId,
          executionTime,
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Ejecuta un workflow simple (single agent)
   */
  async executeSingleAgent(
    agentId: string,
    userInput: string,
    options?: Record<string, any>,
  ): Promise<AgentResponse> {
    const context: WorkflowContext = {
      userInput,
      previousResponses: {},
      metadata: options || {},
    };

    return this.executeAgent(agentId, context);
  }

  /**
   * Valida si un workflow es válido
   */
  validateWorkflow(steps: WorkflowStep[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    const agentIds = steps.map((s) => s.agentId);
    const uniqueAgentIds = new Set(agentIds);

    if (uniqueAgentIds.size !== agentIds.length) {
      errors.push('Workflow has duplicate agent IDs');
    }

    // Verificar que todos los agentes existen
    for (const agentId of uniqueAgentIds) {
      if (!this.agentRegistry.getAgent(agentId)) {
        errors.push(`Agent ${agentId} not found in registry`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
