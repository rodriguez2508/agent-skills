/**
 * Session Entity
 *
 * Represents a chat session.
 * Each session belongs to a user and contains multiple messages.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '@modules/users/domain/entities/user.entity';
import { ChatMessage } from './chat-message.entity';
import { SessionPurpose } from './session-purpose.entity';

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

  @ManyToOne(() => User, (user) => user.sessions, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user?: User;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({ default: SessionStatus.ACTIVE })
  @Index()
  status: SessionStatus;

  @Column({ nullable: true })
  title?: string;

  @Column({ name: 'purpose', type: 'varchar', nullable: true })
  purpose?: string | null; // Specific goal/issue for this session (text description)

  @Column({ type: 'uuid', name: 'purpose_id', nullable: true })
  @Index()
  purposeId?: string; // Foreign key to session_purposes table

  @ManyToOne(() => SessionPurpose, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purpose_id' })
  purposeEntity?: SessionPurpose;

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
