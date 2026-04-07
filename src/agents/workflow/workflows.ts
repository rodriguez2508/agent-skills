import { WorkflowStep, WorkflowContext } from './workflow-engine.service';

/**
 * Workflows predefinidos para diferentes escenarios
 *
 * Cada workflow define una secuencia de agentes a ejecutar
 * para cumplir un objetivo específico.
 */

/**
 * Workflow para análisis completo de proyecto
 *
 * Ejecuta en paralelo:
 * - AnalysisAgent: Analiza código y calidad
 * - ArchitectureAgent: Valida arquitectura
 * - MetricsAgent: Calcula métricas
 *
 * Luego:
 * - RulesAgent: Busca reglas aplicables
 */
export const PROJECT_ANALYSIS_WORKFLOW: WorkflowStep[] = [
  {
    agentId: 'AnalysisAgent',
    order: 1,
    condition: (ctx) => true,
  },
  {
    agentId: 'ArchitectureAgent',
    order: 1,
    parallel: true,
    condition: (ctx) => true,
  },
  {
    agentId: 'MetricsAgent',
    order: 1,
    parallel: true,
    condition: (ctx) => true,
  },
  {
    agentId: 'RulesAgent',
    order: 2,
    condition: (ctx) => {
      // Ejecutar si hay reglas aplicables
      return true;
    },
  },
];

/**
 * Workflow para migración de código
 *
 * Secuencia:
 * 1. AnalysisAgent: Analiza código actual
 * 2. RulesAgent: Busca reglas de migración
 * 3. CodeAgent: Genera nueva versión
 * 4. IssueWorkflowAgent: Actualiza estado del issue
 */
export const CODE_MIGRATION_WORKFLOW: WorkflowStep[] = [
  {
    agentId: 'AnalysisAgent',
    order: 1,
    condition: (ctx) => true,
  },
  {
    agentId: 'RulesAgent',
    order: 2,
    condition: (ctx) => {
      // Buscar reglas relacionadas con migración
      const input = ctx.userInput.toLowerCase();
      return input.includes('migrar') || input.includes('migrate');
    },
  },
  {
    agentId: 'CodeAgent',
    order: 3,
    condition: (ctx) => {
      // Generar código si hay análisis previo
      return ctx.previousResponses['AnalysisAgent']?.success === true;
    },
  },
  {
    agentId: 'IssueWorkflowAgent',
    order: 4,
    condition: (ctx) => !!ctx.issueId,
  },
];

/**
 * Workflow para creación de nueva feature
 *
 * Secuencia:
 * 1. PMAgent: Crea issue y user story
 * 2. ArchitectureAgent: Valida diseño
 * 3. CodeAgent: Implementa feature
 * 4. AnalysisAgent: Verifica calidad
 */
export const FEATURE_CREATION_WORKFLOW: WorkflowStep[] = [
  {
    agentId: 'PMAgent',
    order: 1,
    condition: (ctx) => {
      // Detectar intención de crear feature
      const input = ctx.userInput.toLowerCase();
      return (
        input.includes('crear') ||
        input.includes('implementar') ||
        input.includes('agregar') ||
        input.includes('necesito')
      );
    },
  },
  {
    agentId: 'ArchitectureAgent',
    order: 2,
    parallel: false,
    condition: (ctx) => true,
  },
  {
    agentId: 'CodeAgent',
    order: 3,
    condition: (ctx) => {
      // Implementar si hay diseño aprobado
      return ctx.previousResponses['ArchitectureAgent']?.success === true;
    },
  },
  {
    agentId: 'AnalysisAgent',
    order: 4,
    condition: (ctx) => {
      // Verificar después de implementar
      return ctx.previousResponses['CodeAgent']?.success === true;
    },
  },
];

/**
 * Workflow genérico de búsqueda
 *
 * Ejecuta en paralelo:
 * - SearchAgent: Busca reglas BM25
 * - RulesAgent: Lista reglas relacionadas
 */
export const SEARCH_WORKFLOW: WorkflowStep[] = [
  {
    agentId: 'SearchAgent',
    order: 1,
    condition: (ctx) => true,
  },
  {
    agentId: 'RulesAgent',
    order: 1,
    parallel: true,
    condition: (ctx) => {
      const input = ctx.userInput.toLowerCase();
      return (
        input.includes('regla') ||
        input.includes('rule') ||
        input.includes('buscar') ||
        input.includes('search')
      );
    },
  },
];

/**
 * Workflow para refactorización de código
 *
 * Secuencia:
 * 1. AnalysisAgent: Identifica code smells
 * 2. ArchitectureAgent: Sugiere mejoras
 * 3. CodeAgent: Refactoriza
 * 4. AnalysisAgent: Verifica mejoras
 */
export const REFACTORING_WORKFLOW: WorkflowStep[] = [
  {
    agentId: 'AnalysisAgent',
    order: 1,
    condition: (ctx) => true,
  },
  {
    agentId: 'ArchitectureAgent',
    order: 2,
    condition: (ctx) => {
      // Sugerir mejoras si hay code smells
      return ctx.previousResponses['AnalysisAgent']?.success === true;
    },
  },
  {
    agentId: 'CodeAgent',
    order: 3,
    condition: (ctx) => {
      const input = ctx.userInput.toLowerCase();
      return (
        input.includes('refactor') ||
        input.includes('mejorar') ||
        input.includes('optimizar')
      );
    },
  },
  {
    agentId: 'AnalysisAgent',
    order: 4,
    condition: (ctx) => {
      // Verificar después de refactorizar
      return ctx.previousResponses['CodeAgent']?.success === true;
    },
  },
];

/**
 * Workflow para debugging
 *
 * Secuencia:
 * 1. AnalysisAgent: Analiza error
 * 2. RulesAgent: Busca reglas relacionadas
 * 3. CodeAgent: Sugiere fix
 */
export const DEBUGGING_WORKFLOW: WorkflowStep[] = [
  {
    agentId: 'AnalysisAgent',
    order: 1,
    condition: (ctx) => {
      const input = ctx.userInput.toLowerCase();
      return (
        input.includes('error') ||
        input.includes('bug') ||
        input.includes('falla') ||
        input.includes('problema')
      );
    },
  },
  {
    agentId: 'RulesAgent',
    order: 2,
    condition: (ctx) => true,
  },
  {
    agentId: 'CodeAgent',
    order: 3,
    condition: (ctx) => {
      // Sugerir fix si hay análisis
      return ctx.previousResponses['AnalysisAgent']?.success === true;
    },
  },
];

/**
 * Workflow para onboarding de proyecto
 *
 * Ejecuta en paralelo:
 * - AnalysisAgent: Analiza estructura
 * - ArchitectureAgent: Explica arquitectura
 * - RulesAgent: Muestra reglas aplicables
 */
export const PROJECT_ONBOARDING_WORKFLOW: WorkflowStep[] = [
  {
    agentId: 'AnalysisAgent',
    order: 1,
    condition: (ctx) => {
      const input = ctx.userInput.toLowerCase();
      return (
        input.includes('analiza') ||
        input.includes('explica') ||
        input.includes('quiero entender') ||
        input.includes('onboarding')
      );
    },
  },
  {
    agentId: 'ArchitectureAgent',
    order: 1,
    parallel: true,
    condition: (ctx) => true,
  },
  {
    agentId: 'RulesAgent',
    order: 1,
    parallel: true,
    condition: (ctx) => true,
  },
  {
    agentId: 'MetricsAgent',
    order: 2,
    condition: (ctx) => true,
  },
];

/**
 * Mapa de workflows por intención detectada
 */
export const WORKFLOW_MAP: Record<string, WorkflowStep[]> = {
  analysis: PROJECT_ANALYSIS_WORKFLOW,
  migration: CODE_MIGRATION_WORKFLOW,
  feature: FEATURE_CREATION_WORKFLOW,
  search: SEARCH_WORKFLOW,
  refactoring: REFACTORING_WORKFLOW,
  debugging: DEBUGGING_WORKFLOW,
  onboarding: PROJECT_ONBOARDING_WORKFLOW,
};

/**
 * Obtiene el workflow adecuado según la intención detectada
 *
 * @param intention - Intención detectada por RouterAgent
 * @returns Workflow de pasos o null si no hay workflow específico
 */
export function getWorkflowByIntention(
  intention: string,
): WorkflowStep[] | null {
  return WORKFLOW_MAP[intention] || null;
}

/**
 * Detecta intención basada en el input del usuario
 *
 * @param input - Input del usuario
 * @returns Intención detectada
 */
export function detectIntention(input: string): string {
  const lowerInput = input.toLowerCase();

  // Patrones de migración
  if (
    lowerInput.includes('migrar') ||
    lowerInput.includes('migrate') ||
    lowerInput.includes('actualizar') ||
    lowerInput.includes('update')
  ) {
    return 'migration';
  }

  // Patrones de creación de feature
  if (
    lowerInput.includes('crear') ||
    lowerInput.includes('implementar') ||
    lowerInput.includes('agregar') ||
    lowerInput.includes('necesito') ||
    lowerInput.includes('quiero')
  ) {
    return 'feature';
  }

  // Patrones de refactorización
  if (
    lowerInput.includes('refactor') ||
    lowerInput.includes('mejorar') ||
    lowerInput.includes('optimizar') ||
    lowerInput.includes('limpiar')
  ) {
    return 'refactoring';
  }

  // Patrones de debugging
  if (
    lowerInput.includes('error') ||
    lowerInput.includes('bug') ||
    lowerInput.includes('falla') ||
    lowerInput.includes('problema') ||
    lowerInput.includes('no funciona')
  ) {
    return 'debugging';
  }

  // Patrones de onboarding
  if (
    lowerInput.includes('analiza') ||
    lowerInput.includes('explica') ||
    lowerInput.includes('quiero entender') ||
    lowerInput.includes('onboarding') ||
    lowerInput.includes('conocer')
  ) {
    return 'onboarding';
  }

  // Patrones de búsqueda
  if (
    lowerInput.includes('buscar') ||
    lowerInput.includes('search') ||
    lowerInput.includes('regla') ||
    lowerInput.includes('rule')
  ) {
    return 'search';
  }

  // Por defecto: análisis
  return 'analysis';
}
