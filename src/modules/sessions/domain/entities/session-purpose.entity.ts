/**
 * Session Purpose Entity
 *
 * Represents a specific goal, issue, or task that can span multiple sessions.
 * This allows users to resume work on the same purpose even after sessions expire.
 *
 * Example purposes:
 * - "Fix authentication bug in login endpoint"
 * - "Implement user registration feature"
 * - "Refactor database queries for performance"
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
} from 'typeorm';
import { User } from '@modules/users/domain/entities/user.entity';

export enum SessionPurposeStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

@Entity('session_purposes')
export class SessionPurpose {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  @Index()
  userId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 500 })
  title: string; // Short descriptive title

  @Column({ type: 'text', nullable: true })
  description?: string; // Detailed description of the purpose/issue

  @Column({ default: SessionPurposeStatus.ACTIVE })
  @Index()
  status: SessionPurposeStatus;

  @Column({ name: 'last_session_id', type: 'varchar', nullable: true })
  @Index()
  lastSessionId?: string; // Reference to the most recent session for this purpose

  @Column({ name: 'initial_session_id', type: 'varchar', nullable: true })
  initialSessionId?: string; // Reference to the first session for this purpose

  @Column({ name: 'session_count', default: 0 })
  sessionCount: number; // Number of sessions associated with this purpose

  @Column({ name: 'last_activity_at', nullable: true })
  lastActivityAt?: Date; // Last time any session for this purpose was active

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date; // When the purpose was marked as completed

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: {
    category?: string;
    tags?: string[];
    estimatedSessions?: number;
    actualSessions?: number;
    currentContext?: string;
    nextSteps?: string[];
    keyDecisions?: string[];
    openQuestions?: string[];
    lastUpdatedAt?: string;
    [key: string]: any;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Note: Relationship to Session is defined in Session entity
  // to avoid circular dependency issues
}
