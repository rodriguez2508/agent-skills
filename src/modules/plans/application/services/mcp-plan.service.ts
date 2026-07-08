import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { McpPlan, McpPlanData, McpPlanStatus } from '@modules/plans/domain/entities/mcp-plan.entity';

export interface CreatePlanInput {
  title: string;
  plan: McpPlanData;
  projectId?: string;
  sessionId?: string;
  agentId?: string;
  issueId?: string;
  externalIssueRef?: string;
  dueDate?: Date;
}

@Injectable()
export class McpPlanService {
  private readonly logger = new Logger(McpPlanService.name);

  constructor(
    @InjectRepository(McpPlan)
    private readonly repo: Repository<McpPlan>,
  ) {}

  private isUuid(val?: string): boolean {
    return !!val && /^[0-9a-f-]{36}$/i.test(val);
  }

  async create(input: CreatePlanInput): Promise<McpPlan> {
    const plan = this.repo.create({
      ...input,
      sessionId: input.sessionId || undefined,
      projectId: this.isUuid(input.projectId) ? input.projectId : undefined,
      issueId: this.isUuid(input.issueId) ? input.issueId : undefined,
      status: McpPlanStatus.IN_PROGRESS,
      startedAt: new Date(),
    });
    const saved = await this.repo.save(plan);
    this.logger.log(
      `📋 [Plan:${saved.id.substring(0, 8)}] Created | project:${input.projectId ?? '-'} | session:${input.sessionId ?? '-'} | title: "${input.title}"`,
    );
    return saved;
  }

  async findBySession(sessionId: string): Promise<McpPlan | null> {
    if (!sessionId) return null;
    return this.repo.findOne({
      where: { sessionId, status: McpPlanStatus.IN_PROGRESS },
      order: { createdAt: 'DESC' },
    });
  }

  async findByProject(projectId: string, status?: McpPlanStatus): Promise<McpPlan[]> {
    if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) return [];
    const where: any = { projectId };
    if (status) where.status = status;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async linkIssue(planId: string, issueId: string, externalRef?: string): Promise<void> {
    await this.repo.update(planId, { issueId, externalIssueRef: externalRef });
    this.logger.log(`🔗 [Plan:${planId.substring(0, 8)}] Linked to issue ${issueId}${externalRef ? ` (${externalRef})` : ''}`);
  }

  async updatePlan(planId: string, planData: Partial<McpPlanData>): Promise<void> {
    const existing = await this.repo.findOne({ where: { id: planId } });
    if (!existing) return;
    await this.repo.update(planId, {
      plan: { ...existing.plan, ...planData },
    });
  }

  async complete(planId: string): Promise<void> {
    await this.repo.update(planId, {
      status: McpPlanStatus.COMPLETED,
      completedAt: new Date(),
    });
    this.logger.log(`✅ [Plan:${planId.substring(0, 8)}] Completed`);
  }

  async abandon(planId: string): Promise<void> {
    await this.repo.update(planId, { status: McpPlanStatus.ABANDONED });
    this.logger.log(`🚫 [Plan:${planId.substring(0, 8)}] Abandoned`);
  }

  /**
   * Gets the active plan for a session, or null if none exists.
   * Used to include plan context in logs.
   */
  async getActivePlanContext(sessionId?: string, projectId?: string): Promise<{ planId: string; title: string } | null> {
    if (!sessionId && !projectId) return null;
    try {
      const where: any = { status: McpPlanStatus.IN_PROGRESS };
      if (sessionId) where.sessionId = sessionId;
      else if (projectId) where.projectId = projectId;

      const plan = await this.repo.findOne({ where, order: { createdAt: 'DESC' } });
      if (!plan) return null;
      return { planId: plan.id.substring(0, 8), title: plan.title };
    } catch {
      return null;
    }
  }
}
