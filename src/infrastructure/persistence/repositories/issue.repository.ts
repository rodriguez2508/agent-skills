/**
 * Issue Repository
 *
 * Handles persistence operations for Issue entities.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Issue,
  IssueStatus,
  IssueWorkflowStep,
} from '@modules/issues/domain/entities/issue.entity';

export interface CreateIssueDto {
  issueId: string;
  title: string;
  description?: string;
  requirements?: string;
  userId?: string;
  projectId?: string;
  context?: {
    interactions?: any[];
    projectSnapshot?: any;
    keyDecisions?: any[];
    filesModified?: any[];
    metadata?: Record<string, any>;
  };
  metadata?: {
    labels?: string[];
    estimatedHours?: number;
    autoCreated?: boolean;
    createdAt?: string;
    [key: string]: any;
  };
}

export interface UpdateIssueWorkflowDto {
  currentStep?: IssueWorkflowStep;
  completedSteps?: IssueWorkflowStep[];
  nextSteps?: string[];
  keyDecisions?: { decision: string; rationale: string; timestamp: string }[];
}

@Injectable()
export class IssueRepository {
  constructor(
    @InjectRepository(Issue)
    private readonly repository: Repository<Issue>,
  ) {}

  getRepository(): Repository<Issue> {
    return this.repository;
  }

  /**
   * Creates a new issue
   */
  async create(data: CreateIssueDto): Promise<Issue> {
    const issue = this.repository.create({
      ...data,
      status: IssueStatus.OPEN,
      currentWorkflowStep: IssueWorkflowStep.READ,
      completedSteps: [],
      nextSteps: ['Analyze issue requirements'],
      lastActivityAt: new Date(),
    });

    return await this.repository.save(issue);
  }

  /**
   * Finds an issue by external ID
   */
  async findByIssueId(issueId: string): Promise<Issue | null> {
    return this.repository.findOne({
      where: { issueId },
      relations: ['user'],
    });
  }

  /**
   * Finds an issue by ID
   */
  async findById(id: string): Promise<Issue | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  /**
   * Finds issues for a user
   */
  async findByUserId(userId: string, status?: IssueStatus): Promise<Issue[]> {
    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    return this.repository.find({
      where,
      order: { lastActivityAt: 'DESC' },
    });
  }

  /**
   * Finds active issues (in progress)
   */
  async findActiveIssues(userId?: string): Promise<Issue[]> {
    const where: any = { status: IssueStatus.IN_PROGRESS };
    if (userId) {
      where.userId = userId;
    }

    return this.repository.find({
      where,
      order: { lastActivityAt: 'DESC' },
    });
  }

  /**
   * Updates issue workflow progress
   */
  async updateWorkflow(
    issueId: string,
    data: UpdateIssueWorkflowDto,
  ): Promise<Issue | null> {
    const updateData: any = {
      ...data,
      lastActivityAt: new Date(),
    };

    // If step is completed, add to completedSteps
    if (data.currentStep) {
      const issue = await this.findById(issueId);
      if (issue && issue.completedSteps) {
        if (!issue.completedSteps.includes(data.currentStep)) {
          updateData.completedSteps = [
            ...issue.completedSteps,
            data.currentStep,
          ];
        }
      }
    }

    await this.repository.update({ issueId }, updateData);
    return this.findById(issueId);
  }

  /**
   * Marks issue as in progress
   * @param id - Internal UUID of the issue (not the external issueId like "ISSUE-123")
   */
  async startWorking(id: string): Promise<Issue | null> {
    await this.repository.update(
      { id },
      {
        status: IssueStatus.IN_PROGRESS,
        currentWorkflowStep: IssueWorkflowStep.READ,
        lastActivityAt: new Date(),
      },
    );
    return this.findById(id);
  }

  /**
   * Marks issue as completed
   */
  async complete(issueId: string, prUrl?: string): Promise<Issue | null> {
    const updateData: any = {
      status: IssueStatus.COMPLETED,
      completedAt: new Date(),
      currentWorkflowStep: IssueWorkflowStep.CREATE_PR,
      lastActivityAt: new Date(),
    };

    if (prUrl) {
      updateData.prUrl = prUrl;
    }

    await this.repository.update({ issueId }, updateData);
    return this.findById(issueId);
  }

  /**
   * Updates an issue
   */
  async update(issueId: string, data: Partial<Issue>): Promise<void> {
    await this.repository.update(issueId, data);
  }

  /**
   * Adds a key decision to the issue
   */
  async addKeyDecision(
    issueId: string,
    decision: string,
    rationale: string,
  ): Promise<void> {
    const issue = await this.findById(issueId);
    if (!issue) return;

    const decisions = issue.keyDecisions || [];
    decisions.push({
      decision,
      rationale,
      timestamp: new Date().toISOString(),
    });

    await this.repository.update(issueId, {
      keyDecisions: decisions,
      lastActivityAt: new Date(),
    });
  }

  /**
   * Adds next steps to the issue
   */
  async addNextSteps(issueId: string, steps: string[]): Promise<void> {
    const issue = await this.findById(issueId);
    if (!issue) return;

    const existingSteps = issue.nextSteps || [];
    const updatedSteps = [...existingSteps, ...steps];

    await this.repository.update(issueId, {
      nextSteps: updatedSteps,
      lastActivityAt: new Date(),
    });
  }

  /**
   * Gets statistics about issues
   */
  async getStats(userId?: string): Promise<{
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    abandoned: number;
  }> {
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }

    const [total, open, inProgress, completed, abandoned] = await Promise.all([
      this.repository.count({ where }),
      this.repository.count({ where: { ...where, status: IssueStatus.OPEN } }),
      this.repository.count({
        where: { ...where, status: IssueStatus.IN_PROGRESS },
      }),
      this.repository.count({
        where: { ...where, status: IssueStatus.COMPLETED },
      }),
      this.repository.count({
        where: { ...where, status: IssueStatus.ABANDONED },
      }),
    ]);

    return { total, open, inProgress, completed, abandoned };
  }
}
