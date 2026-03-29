/**
 * Session Entity
 *
 * Represents a chat session for a specific project/issue.
 * Contains complete conversation history in JSONB field.
 *
 * Hierarchy:
 * User → Project → Session → Issue
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
import { ChatMessage } from './chat-message.entity';

export enum SessionStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
  EXPIRED = 'expired',
  INVALID = 'invalid',
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', name: 'session_id' })
  @Index()
  sessionId: string; // External session ID (from MCP client)

  @ManyToOne(() => User, (user) => user.sessions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user?: User;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  // NEW: Direct FK to Project (no relation to avoid circular dependency)
  @Column({ type: 'uuid', name: 'project_id', nullable: true })
  @Index()
  projectId?: string;

  // NEW: Direct FK to Issue (no SessionPurpose intermediary)
  @Column({ type: 'uuid', name: 'issue_id', nullable: true })
  @Index()
  issueId?: string;

  // Note: Don't use @ManyToOne to avoid circular dependency
  // Use issueId directly or load Issue separately via repository

  @Column({ default: SessionStatus.ACTIVE })
  @Index()
  status: SessionStatus;

  @Column({ nullable: true })
  title?: string;

  // DEPRECATED: purpose and purposeEntity removed (replaced by direct issue FK)
  // OLD: @Column({ name: 'purpose', type: 'varchar', nullable: true })
  // OLD: purpose?: string | null;

  // OLD: @Column({ type: 'uuid', name: 'purpose_id', nullable: true })
  // OLD: purposeId?: string;

  // OLD: @ManyToOne(() => SessionPurpose, { nullable: true, onDelete: 'SET NULL' })
  // OLD: purposeEntity?: SessionPurpose;

  @Column({ name: 'is_validated', default: false })
  isValidated: boolean; // True after first meaningful interaction

  @Column({ name: 'validated_at', nullable: true })
  validatedAt?: Date; // When session was validated

  @Column('jsonb', { nullable: true })
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    mcpClient?: string;
    lastAction?: string;
    [key: string]: any;
  };

  @Column({ name: 'message_count', default: 0 })
  messageCount: number;

  @Column({ name: 'last_activity_at', nullable: true })
  lastActivityAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ChatMessage, (message) => message.session, { cascade: true })
  @JoinColumn({ name: 'session_id', referencedColumnName: 'sessionId' })
  messages?: ChatMessage[];
}
