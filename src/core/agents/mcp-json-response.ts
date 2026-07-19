/**
 * Respuestas JSON tipadas para el CLI de Claude Code.
 * Discriminated union por `type` — permite al cliente parsear y renderizar.
 */

interface BaseResponse {
  type: string;
  sessionId: string;
  projectId?: string;
  projectName?: string;
  agentId: string;
  executionTimeMs: number;
  timestamp: string;
}

export interface ActivePlanSummary {
  planId: string;
  title: string;
  status: string;
  agentId?: string;
  createdAt: string;
  dueDate?: string;
}

export interface RecentSessionSummary {
  sessionId: string;
  title?: string;
  lastActivityAt?: string;
  messageCount?: number;
}

export interface RelatedProjectSummary {
  projectId: string;
  name: string;
  path?: string;
  relationType: string;
  direction: 'outgoing' | 'incoming';
}

export interface SessionInitResponse extends BaseResponse {
  type: 'session_init';
  framework?: string;
  architecture?: string;
  agentCatalog: Array<{
    agentId: string;
    name: string;
    category: string;
    categoryIcon: string;
    purpose: string;
  }>;
  isNewProject: boolean;
  activePlans: ActivePlanSummary[];
  recentSessions: RecentSessionSummary[];
  relatedProjects: RelatedProjectSummary[];
  pendingWorkSummary?: string;
  agency?: {
    id: string;
    name: string;
    slug: string;
  };
  projectHistory?: {
    totalMessages: number;
    issuesWorked: string[];
    keyDecisions: string[];
    modulesModified: string[];
    relevantChunks: Array<{ content: string; score: number }>;
  };
}

export interface SuggestedNextStep {
  agentId: string;
  action: string;
  intention: string;
  confidence: number;
  basedOn: string;
  fromPattern: boolean;
}

export interface AgentRoutedResponse extends BaseResponse {
  type: 'agent_response';
  intention: string;
  targetAgent: string;
  message: string;
  data?: Record<string, any>;
  appliedRules: Array<{ id: string; name: string; category: string }>;
  nextAction?: {
    type: 'execute_agent' | 'answer' | 'request_more_info';
    agent?: string;
    task?: string;
  };
  suggestedNext?: SuggestedNextStep;
}

export interface ProjectHistoryResponse extends BaseResponse {
  type: 'project_history';
  totalMessages: number;
  issuesWorked: string[];
  keyDecisions: string[];
  modulesModified: string[];
  relevantChunks: Array<{ content: string; score: number }>;
}

export interface ErrorResponse extends BaseResponse {
  type: 'error';
  error: string;
  code?: string;
}

export type McpJsonResponse =
  | SessionInitResponse
  | AgentRoutedResponse
  | ProjectHistoryResponse
  | ErrorResponse;

/** Construye una SessionInitResponse */
export function buildSessionInitResponse(params: {
  sessionId: string;
  projectId?: string;
  projectName?: string;
  framework?: string;
  architecture?: string;
  agentCatalog: SessionInitResponse['agentCatalog'];
  isNewProject: boolean;
  executionTimeMs: number;
  activePlans?: ActivePlanSummary[];
  recentSessions?: RecentSessionSummary[];
  relatedProjects?: RelatedProjectSummary[];
  pendingWorkSummary?: string;
  agency?: { id: string; name: string; slug: string };
  projectHistory?: SessionInitResponse['projectHistory'];
}): SessionInitResponse {
  return {
    type: 'session_init',
    agentId: 'system',
    timestamp: new Date().toISOString(),
    activePlans: [],
    recentSessions: [],
    relatedProjects: [],
    ...params,
  };
}

/** Construye una AgentRoutedResponse a partir del AgentResponse interno */
export function buildAgentRoutedResponse(params: {
  sessionId: string;
  projectId?: string;
  projectName?: string;
  agentId: string;
  intention: string;
  targetAgent: string;
  message: string;
  data?: Record<string, any>;
  appliedRules: Array<{ id: string; name: string; category: string }>;
  nextAction?: AgentRoutedResponse['nextAction'];
  suggestedNext?: SuggestedNextStep;
  executionTimeMs: number;
}): AgentRoutedResponse {
  return {
    type: 'agent_response',
    timestamp: new Date().toISOString(),
    ...params,
  };
}

/** Construye una ProjectHistoryResponse */
export function buildProjectHistoryResponse(params: {
  sessionId: string;
  projectId?: string;
  projectName?: string;
  agentId: string;
  executionTimeMs: number;
  totalMessages: number;
  issuesWorked: string[];
  keyDecisions: string[];
  modulesModified: string[];
  relevantChunks: Array<{ content: string; score: number }>;
}): ProjectHistoryResponse {
  return {
    type: 'project_history',
    timestamp: new Date().toISOString(),
    ...params,
  };
}

/** Construye una ErrorResponse */
export function buildErrorResponse(params: {
  sessionId: string;
  agentId: string;
  error: string;
  code?: string;
  executionTimeMs: number;
}): ErrorResponse {
  return {
    type: 'error',
    timestamp: new Date().toISOString(),
    ...params,
  };
}
