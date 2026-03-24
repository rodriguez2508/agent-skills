/**
 * Issue Entity
 *
 * Represents a GitHub/GitLab issue that the user is working on.
 * Allows tracking progress across multiple sessions.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from '@modules/users/domain/entities/user.entity';
import { SessionPurpose } from '@modules/sessions/domain/entities/session-purpose.entity';

export enum IssueStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

export enum IssueWorkflowStep {
  READ = '1_READ',
  ANALYZE = '2_ANALYZE',
  PLAN = '3_PLAN',
  CODE = '4_CODE_SOLUTION',
  TEST = '5_TEST_VERIFY',
  COMMIT = '6_COMMIT_CHANGES',
  PUSH = '7_PUSH_TO_BRANCH',
  CREATE_PR_MD = '8_CREATE_PR_MD',
  CREATE_PR = '9_CREATE_PR',
}

@Entity('issues')
export class Issue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  issueId: string; // External issue ID (e.g., "123" or "PROJ-123")

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  requirements?: string; // Acceptance criteria, requirements

  @Column({ default: IssueStatus.OPEN })
  @Index()
  status: IssueStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  currentWorkflowStep: IssueWorkflowStep;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  @Index()
  userId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'repository_url', type: 'varchar', length: 500, nullable: true })
  repositoryUrl?: string;

  @Column({ name: 'branch_name', type: 'varchar', length: 200, nullable: true })
  branchName?: string;

  @Column({ name: 'pr_url', type: 'varchar', length: 500, nullable: true })
  prUrl?: string;

  @Column({ name: 'pr_md_path', type: 'varchar', length: 500, nullable: true })
  prMdPath?: string; // Path to PR.md file

  @Column({ name: 'completed_steps', type: 'jsonb', nullable: true })
  completedSteps?: IssueWorkflowStep[];

  @Column({ name: 'next_steps', type: 'text', array: true, nullable: true })
  nextSteps?: string[];

  @Column({ name: 'key_decisions', type: 'jsonb', nullable: true })
  keyDecisions?: {
    decision: string;
    rationale: string;
    timestamp: string;
  }[];

  @Column({ name: 'files_modified', type: 'text', array: true, nullable: true })
  filesModified?: string[];

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: {
    labels?: string[];
    assignees?: string[];
    milestone?: string;
    estimatedHours?: number;
    actualHours?: number;
    [key: string]: any;
  };

  @Column({ name: 'last_session_id', type: 'uuid', nullable: true })
  lastSessionId?: string;

  @Column({ name: 'last_activity_at', nullable: true })
  lastActivityAt?: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => SessionPurpose, (purpose) => purpose.user)
  @JoinColumn({ name: 'id' })
  sessionPurposes?: SessionPurpose[];
}
