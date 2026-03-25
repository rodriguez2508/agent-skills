/**
 * Issue Service
 *
 * Manages issue creation and tracking.
 * Used by PMAgent to automatically create issues from user requests.
 */

import { Injectable, Logger } from '@nestjs/common';
import { IssueRepository } from '@infrastructure/persistence/repositories/issue.repository';
import { IssueStatus, IssueWorkflowStep } from '@modules/issues/domain/entities/issue.entity';

export interface CreateIssueRequest {
  title: string;
  description?: string;
  requirements?: string;
  userId: string;
  sessionId?: string;
  metadata?: {
    labels?: string[];
    estimatedHours?: number;
    autoCreated?: boolean;
    source?: string;
    initialMessage?: string;
    createdAt?: string;
    [key: string]: any;
  };
}

@Injectable()
export class IssueService {
  private readonly logger = new Logger(IssueService.name);

  constructor(
    private readonly issueRepository: IssueRepository,
  ) {}

  /**
   * Creates a new issue automatically from user request
   */
  async createIssue(data: CreateIssueRequest): Promise<any> {
    this.logger.log(`📋 Creating issue: ${data.title}`);

    const issue = await this.issueRepository.create({
      issueId: `ISSUE-${Date.now()}`, // Auto-generated ID
      title: data.title,
      description: data.description,
      requirements: data.requirements,
      userId: data.userId,
      metadata: {
        ...data.metadata,
        autoCreated: data.metadata?.autoCreated ?? true,
        source: data.metadata?.source ?? 'mcp-conversation',
        sessionId: data.sessionId,
      },
    });

    // Mark issue as in progress
    await this.issueRepository.startWorking(issue.issueId);

    this.logger.log(`✅ Issue created: ${issue.id} (${issue.issueId})`);

    return {
      id: issue.id,
      issueId: issue.issueId,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      currentWorkflowStep: issue.currentWorkflowStep,
      metadata: issue.metadata,
      createdAt: issue.createdAt,
    };
  }

  /**
   * Gets issue by ID
   */
  async getIssueById(issueId: string): Promise<any> {
    const issue = await this.issueRepository.findById(issueId);
    
    if (!issue) {
      return null;
    }

    return {
      id: issue.id,
      issueId: issue.issueId,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      currentWorkflowStep: issue.currentWorkflowStep,
      metadata: issue.metadata,
      createdAt: issue.createdAt,
      lastActivityAt: issue.lastActivityAt,
    };
  }

  /**
   * Gets or creates issue for current conversation
   */
  async getOrCreateIssue(
    userId: string,
    title: string,
    sessionId?: string,
  ): Promise<any> {
    // Try to find active issue for this user
    const activeIssues = await this.issueRepository.findByUserId(userId, IssueStatus.IN_PROGRESS);

    if (activeIssues.length > 0) {
      // Return most recent active issue
      return activeIssues[0];
    }

    // Create new issue
    return this.issueRepository.create({
      issueId: `ISSUE-${Date.now()}`,
      title,
      userId,
      metadata: {
        autoCreated: true,
        sessionId,
        createdAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Updates issue workflow step
   */
  async updateWorkflowStep(
    issueId: string,
    step: string,
    completedSteps?: string[],
  ): Promise<void> {
    await this.issueRepository.updateWorkflow(issueId, {
      currentStep: step as any,
      completedSteps: completedSteps as any,
    });
  }

  /**
   * Adds key decision to issue
   */
  async addKeyDecision(
    issueId: string,
    decision: string,
    rationale: string,
  ): Promise<void> {
    await this.issueRepository.addKeyDecision(issueId, decision, rationale);
  }

  /**
   * Adds next steps to issue
   */
  async addNextSteps(issueId: string, steps: string[]): Promise<void> {
    await this.issueRepository.addNextSteps(issueId, steps);
  }
}
