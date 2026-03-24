/**
 * Issue Repository
 *
 * Handles persistence operations for Issue entities.
 * Tracks issue workflow progress across sessions.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Issue, IssueStatus, IssueWorkflowStep } from '@modules/issues/domain/entities/issue.entity';

export interface CreateIssueDto {
  issueId: string;
  title: string;
  description?: string;
  requirements?: string;
  userId?: string;
  repositoryUrl?: string;
  metadata?: {
    labels?: string[];
    assignees?: string[];
    milestone?: string;
    estimatedHours?: number;
  };
}

export interface UpdateIssueWorkflowDto {
  currentStep?: IssueWorkflowStep;
  completedSteps?: IssueWorkflowStep[];
  nextSteps?: string[];
  keyDecisions?: { decision: string; rationale: string; timestamp: string }[];
  filesModified?: string[];
  branchName?: string;
  prMdPath?: string;
  prUrl?: string;
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
    sessionId?: string,
  ): Promise<Issue | null> {
    const updateData: any = {
      ...data,
      lastActivityAt: new Date(),
    };

    if (sessionId) {
      updateData.lastSessionId = sessionId;
    }

    // If step is completed, add to completedSteps
    if (data.currentStep) {
      const issue = await this.findByIssueId(issueId);
      if (issue && issue.completedSteps) {
        if (!issue.completedSteps.includes(data.currentStep)) {
          updateData.completedSteps = [...issue.completedSteps, data.currentStep];
        }
      }
    }

    await this.repository.update({ issueId }, updateData);
    return this.findByIssueId(issueId);
  }

  /**
   * Marks issue as in progress
   */
  async startWorking(issueId: string): Promise<Issue | null> {
    await this.repository.update(
      { issueId },
      {
        status: IssueStatus.IN_PROGRESS,
        currentWorkflowStep: IssueWorkflowStep.READ,
        lastActivityAt: new Date(),
      },
    );
    return this.findByIssueId(issueId);
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
    return this.findByIssueId(issueId);
  }

  /**
   * Adds a key decision to the issue
   */
  async addKeyDecision(
    issueId: string,
    decision: string,
    rationale: string,
  ): Promise<void> {
    const issue = await this.findByIssueId(issueId);
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
   * Updates files modified in current session
   */
  async addFilesModified(issueId: string, files: string[]): Promise<void> {
    const issue = await this.findByIssueId(issueId);
    if (!issue) return;

    const existingFiles = issue.filesModified || [];
    const uniqueFiles = [...new Set([...existingFiles, ...files])];

    await this.repository.update(issueId, {
      filesModified: uniqueFiles,
      lastActivityAt: new Date(),
    });
  }

  /**
   * Gets workflow progress as percentage
   */
  async getProgress(issueId: string): Promise<number> {
    const issue = await this.findByIssueId(issueId);
    if (!issue) return 0;

    const totalSteps = Object.keys(IssueWorkflowStep).length / 2; // Divide by 2 because of enum quirk
    const completedCount = issue.completedSteps?.length || 0;

    return Math.round((completedCount / totalSteps) * 100);
  }

  /**
   * Gets issues by status for statistics
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
      this.repository.count({ where: { ...where, status: IssueStatus.IN_PROGRESS } }),
      this.repository.count({ where: { ...where, status: IssueStatus.COMPLETED } }),
      this.repository.count({ where: { ...where, status: IssueStatus.ABANDONED } }),
    ]);

    return { total, open, inProgress, completed, abandoned };
  }

  /**
   * Finds issues that haven't had activity for a while
   */
  async findInactiveSince(thresholdDate: Date): Promise<Issue[]> {
    return this.repository.find({
      where: {
        status: IssueStatus.IN_PROGRESS,
        lastActivityAt: thresholdDate,
      },
    });
  }
}
