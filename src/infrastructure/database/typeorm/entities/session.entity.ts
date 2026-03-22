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
import { User } from './user.entity';
import { ChatMessage } from './chat-message.entity';

export enum SessionStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
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

  @Column('jsonb', { nullable: true })
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    mcpClient?: string;
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
}
