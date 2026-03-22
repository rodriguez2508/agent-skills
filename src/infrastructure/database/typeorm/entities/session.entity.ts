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

  @Column()
  @Index()
  sessionId: string; // External session ID (from MCP client)

  @ManyToOne(() => User, (user) => user.sessions, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user?: User;

  @Column({ nullable: true })
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

  @Column({ default: 0 })
  messageCount: number;

  @Column({ nullable: true })
  lastActivityAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ChatMessage, (message) => message.session, { cascade: true })
  messages: ChatMessage[];
}
