/**
 * Schema completo para el contexto de issues
 * 
 * Almacena toda la interacción usuario-agente durante el ciclo de vida de un issue.
 * Permite trazar decisiones, archivos modificados y evolución del trabajo.
 * 
 * @see https://github.com/aajcr/agent-skills-api/blob/main/doc/BUSINESS-IDEA.md
 */

/**
 * Contexto completo de un issue
 */
export interface IssueContext {
  /**
   * Historial completo de interacciones
   * Se actualiza en cada mensaje del usuario/agente
   */
  interactions: Interaction[];

  /**
   * Snapshot del proyecto al crear el issue
   */
  projectSnapshot?: ProjectSnapshot;

  /**
   * Decisiones clave tomadas durante la sesión
   */
  keyDecisions?: KeyDecision[];

  /**
   * Archivos modificados o creados
   */
  filesModified?: FileModification[];

  /**
   * Metadata adicional
   */
  metadata?: Record<string, any>;
}

/**
 * Una interacción individual en el historial
 */
export interface Interaction {
  /**
   * Timestamp ISO 8601
   * Ejemplo: "2026-03-28T10:00:00Z"
   */
  timestamp: string;
  
  /**
   * Rol del participante
   */
  role: 'user' | 'agent' | 'system';
  
  /**
   * Contenido del mensaje
   */
  content: string;
  
  /**
   * ID del agente (si role === 'agent')
   * Ejemplo: "AnalysisAgent", "CodeAgent", "PMAgent"
   */
  agentId?: string;
  
  /**
   * Metadata de la interacción
   */
  metadata?: InteractionMetadata;
}

/**
 * Metadata de una interacción
 */
export interface InteractionMetadata {
  /**
   * Intención detectada por RouterAgent
   * Ejemplo: "analysis", "code", "pm", "issue-workflow"
   */
  intention?: string;
  
  /**
   * Agentes invocados para esta interacción
   */
  agentsInvoked?: string[];
  
  /**
   * Reglas de código aplicadas
   */
  rulesApplied?: string[];
  
  /**
   * Tiempo de ejecución en milisegundos
   */
  executionTime?: number;
  
  /**
   * Errores si los hubo
   */
  errors?: string[];
  
  /**
   * Path del proyecto (si aplica)
   */
  projectPath?: string;
  
  /**
   * ID del issue (si se creó/actualizó)
   */
  issueId?: string;
}

/**
 * Snapshot del proyecto al momento de crear el issue
 */
export interface ProjectSnapshot {
  /**
   * Nombre del proyecto (del package.json)
   */
  name: string;
  
  /**
   * Versión del proyecto (del package.json)
   */
  version?: string;
  
  /**
   * Dependencias principales
   */
  dependencies: Record<string, string>;
  
  /**
   * Dev dependencies
   */
  devDependencies?: Record<string, string>;
  
  /**
   * Scripts disponibles
   */
  scripts?: Record<string, string>;
  
  /**
   * Framework detectado
   */
  detectedFramework?: 'angular' | 'nestjs' | 'react' | 'vue' | 'nextjs' | 'nuxtjs' | 'svelte' | 'node-express' | 'node-fastify' | 'node';
  
  /**
   * Arquitectura detectada
   */
  detectedArchitecture?: 'hexagonal' | 'clean' | 'nestjs' | 'angular' | 'standard' | 'unknown';
  
  /**
   * Lenguaje principal
   */
  language?: 'TypeScript' | 'JavaScript' | 'Unknown';
}

/**
 * Decisión clave tomada durante el trabajo
 */
export interface KeyDecision {
  /**
   * Decisión tomada
   */
  decision: string;
  
  /**
   * Razonamiento detrás de la decisión
   */
  rationale: string;
  
  /**
   * Timestamp de la decisión
   */
  timestamp: string;
  
  /**
   * Alternativas consideradas
   */
  alternatives?: string[];
  
  /**
   * Agente que tomó la decisión
   */
  agentId?: string;
}

/**
 * Archivo modificado o creado
 */
export interface FileModification {
  /**
   * Path relativo del archivo
   * Ejemplo: "src/users/users.service.ts"
   */
  path: string;
  
  /**
   * Acción realizada
   */
  action: 'create' | 'modify' | 'delete';
  
  /**
   * Líneas añadidas
   */
  linesAdded?: number;
  
  /**
   * Líneas removidas
   */
  linesRemoved?: number;
  
  /**
   * Diff (opcional, puede ser grande)
   */
  diff?: string;
  
  /**
   * Timestamp de la modificación
   */
  timestamp?: string;
}

/**
 * Helper para crear un contexto vacío
 */
export function createEmptyContext(): IssueContext {
  return {
    interactions: [],
    projectSnapshot: undefined,
    keyDecisions: [],
    filesModified: [],
    metadata: {},
  };
}

/**
 * Helper para añadir interacción al contexto
 */
export function addInteraction(
  context: IssueContext,
  interaction: Omit<Interaction, 'timestamp'>,
): IssueContext {
  return {
    ...context,
    interactions: [
      ...context.interactions,
      {
        ...interaction,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Helper para añadir decisión clave
 */
export function addKeyDecision(
  context: IssueContext,
  decision: Omit<KeyDecision, 'timestamp'>,
): IssueContext {
  return {
    ...context,
    keyDecisions: [
      ...(context.keyDecisions || []),
      {
        ...decision,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Helper para añadir modificación de archivo
 */
export function addFileModification(
  context: IssueContext,
  file: Omit<FileModification, 'timestamp'>,
): IssueContext {
  return {
    ...context,
    filesModified: [
      ...(context.filesModified || []),
      {
        ...file,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
