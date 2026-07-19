/**
 * Agency Resources Repository Port
 *
 * Contract for agency-specific resources: skills, rules, agents, workflows.
 * Each resource is scoped to a single agency (tenant).
 */

import { AgencySkill } from '../entities/agency-skill.entity';
import { AgencyRule } from '../entities/agency-rule.entity';
import { AgencyAgent } from '../entities/agency-agent.entity';
import { AgencyWorkflow } from '../entities/agency-workflow.entity';

export interface CreateAgencySkillData {
  agencyId: string;
  name: string;
  description?: string;
  promptTemplate: string;
  tags?: string[];
  inputVariables?: string[];
  isPublished?: boolean;
}

export interface CreateAgencyRuleData {
  agencyId: string;
  name: string;
  description?: string;
  category?: string;
  ruleContent: string;
  enforcementLevel?: string;
  priority?: number;
}

export interface CreateAgencyAgentData {
  agencyId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  tools?: string[];
  type?: string;
  skillIds?: string[];
  ruleIds?: string[];
}

export interface CreateAgencyWorkflowData {
  agencyId: string;
  name: string;
  description?: string;
  steps: any;
  triggerType?: string;
  triggerConfig?: any;
}

export interface PublishResourceData {
  skillId?: string;
  ruleId?: string;
  agentId?: string;
  workflowId?: string;
  isPublished: boolean;
}

export abstract class IAgencyResourcesRepository {
  // Skills
  abstract createSkill(data: CreateAgencySkillData): Promise<AgencySkill>;
  abstract findSkillById(id: string): Promise<AgencySkill | null>;
  abstract findSkillsByAgencyId(agencyId: string): Promise<AgencySkill[]>;
  abstract findPublishedSkills(agencyId: string): Promise<AgencySkill[]>;
  abstract updateSkill(id: string, data: Partial<AgencySkill>): Promise<AgencySkill>;
  abstract deleteSkill(id: string): Promise<void>;
  abstract incrementSkillUsage(id: string): Promise<void>;

  // Rules
  abstract createRule(data: CreateAgencyRuleData): Promise<AgencyRule>;
  abstract findRuleById(id: string): Promise<AgencyRule | null>;
  abstract findRulesByAgencyId(agencyId: string): Promise<AgencyRule[]>;
  abstract findActiveRulesByAgencyId(agencyId: string): Promise<AgencyRule[]>;
  abstract findRulesByCategory(agencyId: string, category: string): Promise<AgencyRule[]>;
  abstract updateRule(id: string, data: Partial<AgencyRule>): Promise<AgencyRule>;
  abstract deleteRule(id: string): Promise<void>;

  // Agents
  abstract createAgent(data: CreateAgencyAgentData): Promise<AgencyAgent>;
  abstract findAgentById(id: string): Promise<AgencyAgent | null>;
  abstract findAgentsByAgencyId(agencyId: string): Promise<AgencyAgent[]>;
  abstract findActiveAgentsByAgencyId(agencyId: string): Promise<AgencyAgent[]>;
  abstract updateAgent(id: string, data: Partial<AgencyAgent>): Promise<AgencyAgent>;
  abstract deleteAgent(id: string): Promise<void>;

  // Workflows
  abstract createWorkflow(data: CreateAgencyWorkflowData): Promise<AgencyWorkflow>;
  abstract findWorkflowById(id: string): Promise<AgencyWorkflow | null>;
  abstract findWorkflowsByAgencyId(agencyId: string): Promise<AgencyWorkflow[]>;
  abstract findActiveWorkflowsByAgencyId(agencyId: string): Promise<AgencyWorkflow[]>;
  abstract updateWorkflow(id: string, data: Partial<AgencyWorkflow>): Promise<AgencyWorkflow>;
  abstract deleteWorkflow(id: string): Promise<void>;
  abstract incrementWorkflowExecution(id: string, success: boolean): Promise<void>;

  // Marketplace
  abstract findMarketplaceResources(agencyId?: string): Promise<{
    skills: AgencySkill[];
    rules: AgencyRule[];
    agents: AgencyAgent[];
    workflows: AgencyWorkflow[];
  }>;
}
