/**
 * ChatMessage Entity
 * 
 * Represents a single message in a chat session.
 * Can be from user (role: user) or assistant (role: assistant).
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Session } from './session.entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', name: 'session_id' })
  @Index()
  sessionId: string;

  @Column({
    type: 'enum',
    enum: MessageRole,
    default: MessageRole.USER,
  })
  @Index()
  role: MessageRole;

  @Column('text')
  content: string;

  @Column('jsonb', { nullable: true })
  metadata?: {
    agentId?: string;
    toolsUsed?: string[];
    rulesApplied?: string[];
    searchQuery?: string;
    searchResults?: number;
    executionTime?: number;
    [key: string]: any;
  };

  @Column({ name: 'parent_message_id', nullable: true })
  @Index()
  parentMessageId?: string;

  @Column({ name: 'token_count', default: 0 })
  tokenCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
