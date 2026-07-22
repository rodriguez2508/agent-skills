/**
 * ChatMessage Entity
 *
 * Represents a message in a chat session.
 * Messages are linked to both Session and Issue for proper tracking.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'varchar' })
  @Index()
  sessionId: string;

  @Column({ name: 'issue_id', type: 'uuid', nullable: true })
  @Index()
  issueId?: string;

  @Column({ type: 'enum', enum: MessageRole, default: MessageRole.USER })
  @Index()
  role: MessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column('jsonb', { nullable: true })
  metadata?: any;

  @Column({ name: 'parent_message_id', type: 'uuid', nullable: true })
  @Index()
  parentMessageId?: string;

  @Column({ name: 'token_count', default: 0 })
  tokenCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
