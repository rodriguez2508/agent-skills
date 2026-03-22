/**
 * User Entity
 * 
 * Represents a user in the system.
 * Used for authentication, preferences, and analytics.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Session } from './session.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ default: true })
  active: boolean;

  @Column('jsonb', { nullable: true })
  preferences?: {
    defaultCategory?: string;
    searchLimit?: number;
    theme?: 'light' | 'dark';
    language?: string;
  };

  @Column({ default: 0 })
  @Index()
  totalSessions: number;

  @Column({ default: 0 })
  totalSearches: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Session, (session) => session.user, { cascade: true })
  sessions: Session[];
}
