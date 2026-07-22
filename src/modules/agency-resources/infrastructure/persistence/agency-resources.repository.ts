/**
 * Agency Resources Repository (TypeORM Implementation)
 *
 * Handles agency-specific resources persistence with PostgreSQL.
 * All queries are scoped to agencyId for multi-tenancy isolation.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { AgencySkill } from '@agency-resources/domain/entities/agency-skill.entity';
import { AgencyRule } from '@agency-resources/domain/entities/agency-rule.entity';
import { AgencyAgent } from '@agency-resources/domain/entities/agency-agent.entity';
import { AgencyWorkflow } from '@agency-resources/domain/entities/agency-workflow.entity';
import {
  IAgencyResourcesRepository,
  CreateAgencySkillData,
  CreateAgencyRuleData,
  CreateAgencyAgentData,
  CreateAgencyWorkflowData,
} from '@agency-resources/domain/ports/agency-resources-repository.port';

@Injectable()
export class AgencyResourcesRepository implements IAgencyResourcesRepository {
  private readonly logger = new Logger(AgencyResourcesRepository.name);

  constructor(
    @InjectRepository(AgencySkill)
    private readonly skillRepo: Repository<AgencySkill>,
    @InjectRepository(AgencyRule)
    private readonly ruleRepo: Repository<AgencyRule>,
    @InjectRepository(AgencyAgent)
    private readonly agentRepo: Repository<AgencyAgent>,
    @InjectRepository(AgencyWorkflow)
    private readonly workflowRepo: Repository<AgencyWorkflow>,
  ) {}

  // ───────────────────────────────
  //  Skills
  // ───────────────────────────────

  async createSkill(data: CreateAgencySkillData): Promise<AgencySkill> {
    const skill = this.skillRepo.create({
      agencyId: data.agencyId,
      name: data.name,
      description: data.description,
      promptTemplate: data.promptTemplate,
      categoryId: data.categoryId || null,
      tags: data.tags || [],
      inputVariables: data.inputVariables || [],
      isPublished: data.isPublished || false,
      isPermanent: data.isPermanent || false,
    });
    const saved = await this.skillRepo.save(skill);
    this.logger.debug(`🎨 Skill created: ${saved.id} (${saved.name})`);
    return saved;
  }

  async findSkillById(id: string): Promise<AgencySkill | null> {
    return this.skillRepo.findOne({ where: { id } });
  }

  async findSkillsByAgencyId(agencyId: string): Promise<AgencySkill[]> {
    return this.skillRepo.find({
      where: { agencyId },
      order: { createdAt: 'DESC' },
    });
  }

  async findPublishedSkills(agencyId: string): Promise<AgencySkill[]> {
    return this.skillRepo.find({
      where: { agencyId, isPublished: true },
      order: { usageCount: 'DESC', name: 'ASC' },
    });
  }

  async updateSkill(id: string, data: Partial<AgencySkill>): Promise<AgencySkill> {
    await this.skillRepo.update(id, data);
    const updated = await this.findSkillById(id);
    if (!updated) throw new Error(`Skill not found after update: ${id}`);
    return updated;
  }

  async deleteSkill(id: string): Promise<void> {
    const skill = await this.findSkillById(id);
    if (skill) {
      await this.skillRepo.remove(skill);
      this.logger.debug(`🗑️ Skill deleted: ${id}`);
    }
  }

  async incrementSkillUsage(id: string): Promise<void> {
    await this.skillRepo.increment({ id }, 'usageCount', 1);
  }

  // ───────────────────────────────
  //  Rules
  // ───────────────────────────────

  async createRule(data: CreateAgencyRuleData): Promise<AgencyRule> {
    const rule = this.ruleRepo.create({
      agencyId: data.agencyId,
      name: data.name,
      description: data.description,
      category: (data.category || 'custom') as any,
      ruleContent: data.ruleContent,
      enforcementLevel: (data.enforcementLevel || 'soft') as any,
      priority: data.priority || 0,
    });
    const saved = await this.ruleRepo.save(rule);
    this.logger.debug(`📏 Rule created: ${saved.id} (${saved.name})`);
    return saved;
  }

  async findRuleById(id: string): Promise<AgencyRule | null> {
    return this.ruleRepo.findOne({ where: { id } });
  }

  async findRulesByAgencyId(agencyId: string): Promise<AgencyRule[]> {
    return this.ruleRepo.find({
      where: { agencyId },
      order: { priority: 'DESC', name: 'ASC' },
    });
  }

  async findActiveRulesByAgencyId(agencyId: string): Promise<AgencyRule[]> {
    return this.ruleRepo.find({
      where: { agencyId, isActive: true },
      order: { priority: 'DESC', name: 'ASC' },
    });
  }

  async findRulesByCategory(agencyId: string, category: string): Promise<AgencyRule[]> {
    return this.ruleRepo.find({
      where: { agencyId, category: category as any, isActive: true },
      order: { priority: 'DESC' },
    });
  }

  async updateRule(id: string, data: Partial<AgencyRule>): Promise<AgencyRule> {
    await this.ruleRepo.update(id, data);
    const updated = await this.findRuleById(id);
    if (!updated) throw new Error(`Rule not found after update: ${id}`);
    return updated;
  }

  async deleteRule(id: string): Promise<void> {
    const rule = await this.findRuleById(id);
    if (rule) {
      await this.ruleRepo.remove(rule);
      this.logger.debug(`🗑️ Rule deleted: ${id}`);
    }
  }

  // ───────────────────────────────
  //  Agents
  // ───────────────────────────────

  async createAgent(data: CreateAgencyAgentData): Promise<AgencyAgent> {
    const agent = this.agentRepo.create({
      agencyId: data.agencyId,
      name: data.name,
      description: data.description,
      systemPrompt: data.systemPrompt,
      tools: data.tools || [],
      type: (data.type || 'conversational') as any,
      skillIds: data.skillIds || [],
      ruleIds: data.ruleIds || [],
    });
    const saved = await this.agentRepo.save(agent);
    this.logger.debug(`🤖 Agent created: ${saved.id} (${saved.name})`);
    return saved;
  }

  async findAgentById(id: string): Promise<AgencyAgent | null> {
    return this.agentRepo.findOne({ where: { id } });
  }

  async findAgentsByAgencyId(agencyId: string): Promise<AgencyAgent[]> {
    return this.agentRepo.find({
      where: { agencyId },
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveAgentsByAgencyId(agencyId: string): Promise<AgencyAgent[]> {
    return this.agentRepo.find({
      where: { agencyId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async updateAgent(id: string, data: Partial<AgencyAgent>): Promise<AgencyAgent> {
    await this.agentRepo.update(id, data);
    const updated = await this.findAgentById(id);
    if (!updated) throw new Error(`Agent not found after update: ${id}`);
    return updated;
  }

  async deleteAgent(id: string): Promise<void> {
    const agent = await this.findAgentById(id);
    if (agent) {
      await this.agentRepo.remove(agent);
      this.logger.debug(`🗑️ Agent deleted: ${id}`);
    }
  }

  // ───────────────────────────────
  //  Workflows
  // ───────────────────────────────

  async createWorkflow(data: CreateAgencyWorkflowData): Promise<AgencyWorkflow> {
    const workflow = this.workflowRepo.create({
      agencyId: data.agencyId,
      name: data.name,
      description: data.description,
      steps: data.steps,
      triggerType: data.triggerType || 'sequential',
      triggerConfig: data.triggerConfig || {},
    });
    const saved = await this.workflowRepo.save(workflow);
    this.logger.debug(`⚙️ Workflow created: ${saved.id} (${saved.name})`);
    return saved;
  }

  async findWorkflowById(id: string): Promise<AgencyWorkflow | null> {
    return this.workflowRepo.findOne({ where: { id } });
  }

  async findWorkflowsByAgencyId(agencyId: string): Promise<AgencyWorkflow[]> {
    return this.workflowRepo.find({
      where: { agencyId },
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveWorkflowsByAgencyId(agencyId: string): Promise<AgencyWorkflow[]> {
    return this.workflowRepo.find({
      where: { agencyId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async updateWorkflow(id: string, data: Partial<AgencyWorkflow>): Promise<AgencyWorkflow> {
    await this.workflowRepo.update(id, data);
    const updated = await this.findWorkflowById(id);
    if (!updated) throw new Error(`Workflow not found after update: ${id}`);
    return updated;
  }

  async deleteWorkflow(id: string): Promise<void> {
    const workflow = await this.findWorkflowById(id);
    if (workflow) {
      await this.workflowRepo.remove(workflow);
      this.logger.debug(`🗑️ Workflow deleted: ${id}`);
    }
  }

  async incrementWorkflowExecution(id: string, success: boolean): Promise<void> {
    await this.workflowRepo.increment({ id }, 'executionCount', 1);
    if (success) {
      await this.workflowRepo.increment({ id }, 'successCount', 1);
    }
  }

  // ───────────────────────────────
  //  Marketplace
  // ───────────────────────────────

  async findMarketplaceResources(excludeAgencyId?: string): Promise<{
    skills: AgencySkill[];
    rules: AgencyRule[];
    agents: AgencyAgent[];
    workflows: AgencyWorkflow[];
  }> {
    const whereFilter = excludeAgencyId
      ? { isPublished: true, agencyId: Not(excludeAgencyId) }
      : { isPublished: true };

    const [skills, rules, agents, workflows] = await Promise.all([
      this.skillRepo.find({ where: whereFilter as any, order: { usageCount: 'DESC' } }),
      this.ruleRepo.find({ where: { isPublished: true } as any, order: { name: 'ASC' } }),
      this.agentRepo.find({ where: { isPublished: true } as any, order: { name: 'ASC' } }),
      this.workflowRepo.find({ where: { isPublished: true } as any, order: { name: 'ASC' } }),
    ]);

    return { skills, rules, agents, workflows };
  }
}
