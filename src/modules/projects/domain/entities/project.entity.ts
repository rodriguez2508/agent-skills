/**
 * Project Entity
 *
 * Represents a project that the user is working on.
 * Can have multiple sessions and issues.
 *
 * Hierarchy:
 * User → Project → Session/Issue
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

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  @Index()
  name: string; // Project name (e.g., "linki-f", "agent-skills-api")

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'repo_url' })
  repoUrl?: string; // GitHub/GitLab repository URL

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'default_branch', default: 'main' })
  defaultBranch: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    language?: string;
    framework?: string;
    lastAnalyzedAt?: string;
    [key: string]: any;
  };

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  @Index()
  userId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
