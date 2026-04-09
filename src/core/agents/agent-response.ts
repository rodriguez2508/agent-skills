/**
 * Acción ejecutable que el agente devuelve
 */
export interface AgentAction {
  type: 'execute_agent' | 'answer' | 'request_more_info';
  agent?: string;
  action: string;
  task?: string;
  context?: Record<string, any>;
}

/**
 * Respuesta estándar de un agente
 */
export interface AgentResponse {
  success: boolean;
  data?: {
    message?: string;
    targetAgent?: string;
    nextAction?: AgentAction;
    [key: string]: any;
  };
  error?: string;
  metadata?: {
    agentId: string;
    executionTime: number;
    timestamp: Date;
  };
}

/**
 * Request estándar para un agente
 */
export interface AgentRequest {
  input: string;
  context?: Record<string, any>;
  options?: Record<string, any>;
  clearContext?: boolean;
}
