import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum McpPlanStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

export interface McpPlanStep {
  order: number;
  description: string;
  agentId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completedAt?: string;
  notes?: string;
}

export interface McpPlanData {
  summary: string;
  detectedIntention: string;
  steps: McpPlanStep[];
  rulesApplied: Array<{ id: string; name: string; category: string }>;
  agentsInvolved: string[];
  bm25Matches?: Array<{ content: string; score: number }>;
  metadata?: Record<string, any>;
}

@Entity('mcp_plans')
export class McpPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'varchar', length: 50, default: McpPlanStatus.OPEN })
  @Index()
  status: McpPlanStatus;

  @Column({ type: 'jsonb', name: 'plan' })
  plan: McpPlanData;

  @Column({ type: 'uuid', name: 'project_id', nullable: true })
  @Index()
  projectId?: string;

  @Column({ type: 'varchar', length: 100, name: 'session_id', nullable: true })
  @Index()
  sessionId?: string;

  @Column({ type: 'varchar', length: 100, name: 'agent_id', nullable: true })
  agentId?: string;

  // FK to issues table (GitHub/GitLab issue, nullable)
  @Column({ type: 'uuid', name: 'issue_id', nullable: true })
  @Index()
  issueId?: string;

  // External issue reference (e.g. "GH-123", "PROJ-45")
  @Column({ type: 'varchar', length: 100, name: 'external_issue_ref', nullable: true })
  externalIssueRef?: string;

  @Column({ type: 'timestamp', name: 'due_date', nullable: true })
  dueDate?: Date;

  @Column({ type: 'timestamp', name: 'started_at', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', name: 'completed_at', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
