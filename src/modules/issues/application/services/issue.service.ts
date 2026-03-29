/**
 * Issue Service
 *
 * Manages issue creation and tracking.
 * Used by PMAgent to automatically create issues from user requests.
 */

import { Injectable, Logger } from '@nestjs/common';
import { IssueRepository } from '@infrastructure/persistence/repositories/issue.repository';
import {
  IssueStatus,
  IssueWorkflowStep,
} from '@modules/issues/domain/entities/issue.entity';
import {
  IssueContext,
  Interaction,
  KeyDecision,
  FileModification,
  ProjectSnapshot,
  createEmptyContext,
} from '@modules/issues/domain/entities/issue-context.schema';

export interface CreateIssueRequest {
  title: string;
  description?: string;
  requirements?: string;
  userId: string;
  sessionId?: string;
  projectId?: string;
  context?: Partial<IssueContext>;
  metadata?: {
    labels?: string[];
    estimatedHours?: number;
    autoCreated?: boolean;
    source?: string;
    initialMessage?: string;
    createdAt?: string;
    projectName?: string;
    contextualIssueId?: string;
    [key: string]: any;
  };
}

export interface AddInteractionRequest {
  role: 'user' | 'agent' | 'system';
  content: string;
  agentId?: string;
  metadata?: Interaction['metadata'];
}

@Injectable()
export class IssueService {
  private readonly logger = new Logger(IssueService.name);

  constructor(private readonly issueRepository: IssueRepository) {}

  /**
   * Creates a new issue automatically from user request
   */
  async createIssue(data: CreateIssueRequest): Promise<any> {
    // Generate contextual issue ID
    const contextualId =
      data.metadata?.contextualIssueId || data.metadata?.projectName
        ? `${data.metadata.projectName}-${Date.now().toString(36).substring(0, 6)}`
        : `ISSUE-${Date.now()}`;

    this.logger.log(
      `📋 Creating issue: ${data.title} | Contextual ID: ${contextualId} | Project: ${data.projectId || 'none'}`,
    );

    // Initialize context if provided
    let context: IssueContext | undefined;
    if (data.context) {
      context = {
        ...createEmptyContext(),
        ...data.context,
      };
    }

    const issue = await this.issueRepository.create({
      issueId: contextualId,
      title: data.title,
      description: data.description,
      requirements: data.requirements,
      userId: data.userId,
      projectId: data.projectId,
      context,
      metadata: {
        ...data.metadata,
        autoCreated: data.metadata?.autoCreated ?? true,
        source: data.metadata?.source ?? 'mcp-conversation',
        sessionId: data.sessionId,
      },
    });

    // Mark issue as in progress (use internal id, not external issueId)
    await this.issueRepository.startWorking(issue.id);

    this.logger.log(
      `✅ Issue created: ${issue.id} (${issue.issueId}) | ProjectId: ${data.projectId || 'none'}`,
    );

    return {
      id: issue.id,
      issueId: issue.issueId,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      currentWorkflowStep: issue.currentWorkflowStep,
      context: issue.context,
      metadata: issue.metadata,
      projectId: issue.projectId,
      createdAt: issue.createdAt,
    };
  }

  /**
   * Gets issue by ID with full context
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
      context: issue.context,
      metadata: issue.metadata,
      filesModified: issue.filesModified,
      keyDecisions: issue.keyDecisions,
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
    const activeIssues = await this.issueRepository.findByUserId(
      userId,
      IssueStatus.IN_PROGRESS,
    );

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
   * Adds interaction to issue context
   */
  async addInteraction(
    issueId: string,
    interaction: AddInteractionRequest,
  ): Promise<any> {
    const issue = await this.issueRepository.findById(issueId);

    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    // Initialize context if not exists
    if (!issue.context) {
      issue.context = createEmptyContext();
    }

    // Add interaction
    const newInteraction: Interaction = {
      ...interaction,
      timestamp: new Date().toISOString(),
    };

    issue.context.interactions = [
      ...(issue.context.interactions || []),
      newInteraction,
    ];

    // Update metadata
    issue.lastActivityAt = new Date();
    issue.metadata = {
      ...issue.metadata,
      lastInteractionAt: newInteraction.timestamp,
      totalInteractions: issue.context.interactions.length,
    };

    await this.issueRepository.update(issueId, issue);

    this.logger.log(
      `💬 Interaction added to issue ${issueId} | Role: ${interaction.role} | Total: ${issue.context.interactions.length}`,
    );

    return {
      id: issue.id,
      issueId: issue.issueId,
      totalInteractions: issue.context.interactions.length,
      lastActivityAt: issue.lastActivityAt,
    };
  }

  /**
   * Adds key decision to issue context
   */
  async addKeyDecision(
    issueId: string,
    decision: Omit<KeyDecision, 'timestamp'>,
  ): Promise<any> {
    const issue = await this.issueRepository.findById(issueId);

    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    if (!issue.context) {
      issue.context = createEmptyContext();
    }

    const newDecision: KeyDecision = {
      ...decision,
      timestamp: new Date().toISOString(),
    };

    issue.context.keyDecisions = [
      ...(issue.context.keyDecisions || []),
      newDecision,
    ];

    await this.issueRepository.update(issueId, issue);

    this.logger.log(
      `🎯 Key decision added to issue ${issueId}: ${decision.decision}`,
    );

    return {
      id: issue.id,
      issueId: issue.issueId,
      keyDecisions: issue.context.keyDecisions,
    };
  }

  /**
   * Adds file modifications to issue context
   */
  async addFileModifications(
    issueId: string,
    files: Omit<FileModification, 'timestamp'>[],
  ): Promise<any> {
    const issue = await this.issueRepository.findById(issueId);

    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    const newFiles: FileModification[] = files.map((file) => ({
      ...file,
      timestamp: new Date().toISOString(),
    }));

    // Initialize context if not exists
    if (!issue.context) {
      issue.context = createEmptyContext();
    }

    // Update filesModified in context
    issue.context.filesModified = [
      ...(issue.context.filesModified || []),
      ...newFiles,
    ];

    // Also update legacy filesModified array for backward compatibility
    issue.filesModified = [
      ...(issue.filesModified || []),
      ...newFiles.map((f) => f.path),
    ];

    await this.issueRepository.update(issueId, issue);

    this.logger.log(
      `📁 Added ${newFiles.length} file modifications to issue ${issueId}`,
    );

    return {
      id: issue.id,
      issueId: issue.issueId,
      filesModified: issue.context.filesModified,
      totalFiles: issue.context.filesModified.length,
    };
  }

  /**
   * Updates issue project snapshot
   */
  async updateProjectSnapshot(
    issueId: string,
    snapshot: Partial<ProjectSnapshot>,
  ): Promise<any> {
    const issue = await this.issueRepository.findById(issueId);

    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    if (!issue.context) {
      issue.context = createEmptyContext();
    }

    issue.context.projectSnapshot = {
      ...(issue.context.projectSnapshot || ({} as ProjectSnapshot)),
      ...snapshot,
    } as ProjectSnapshot;

    await this.issueRepository.update(issueId, issue);

    this.logger.log(
      `📸 Project snapshot updated for issue ${issueId}: ${snapshot.name}`,
    );

    return {
      id: issue.id,
      issueId: issue.issueId,
      projectSnapshot: issue.context.projectSnapshot,
    };
  }

  /**
   * Gets interaction history for issue
   */
  async getInteractionHistory(issueId: string): Promise<Interaction[]> {
    const issue = await this.issueRepository.findById(issueId);
    return issue?.context?.interactions || [];
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
   * Adds next steps to issue
   */
  async addNextSteps(issueId: string, steps: string[]): Promise<void> {
    await this.issueRepository.addNextSteps(issueId, steps);
  }
}
