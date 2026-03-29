/**
 * Context Entity
 *
 * Represents conversation context for an issue.
 * Automatically updated based on what the user requests.
 *
 * Hierarchy:
 * User → Project → Issue → Context (multiple)
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ContextType {
  ANALYSIS = 'analysis',
  IMPLEMENTATION = 'implementation',
  RESEARCH = 'research',
  DISCUSSION = 'discussion',
  REVIEW = 'review',
  COMMAND = 'command',
}

@Entity('contexts')
export class Context {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  contextId: string; // External ID (e.g., "CTX-001")

  @Column({ type: 'varchar', length: 100 })
  @Index()
  type: ContextType; // Type of context

  @Column({ type: 'text', nullable: true })
  summary?: string; // Brief summary of this context

  @Column({ type: 'jsonb', nullable: true })
  messages?: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  extractedInfo?: {
    filesModified?: string[];
    decisions?: string[];
    codeSnippets?: string[];
    commands?: string[];
    [key: string]: any;
  };

  @Column({ type: 'uuid', name: 'issue_id', nullable: true })
  @Index()
  issueId?: string;

  @Column({ name: 'is_active', default: true })
  @Index()
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    projectPath?: string;
    language?: string;
    framework?: string;
    lastMessageAt?: string;
    messageCount?: number;
    [key: string]: any;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
