/**
 * Respuesta estándar de un agente
 */
export interface AgentResponse {
  success: boolean;
  data?: any;
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
}
