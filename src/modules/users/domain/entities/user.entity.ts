/**
 * User Entity
 *
 * Represents a user in the system.
 * Users are grouped by IP address.
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
import { Session } from '@modules/sessions/domain/entities/session.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true, select: false })
  password?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ default: true })
  active: boolean;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken?: string;

  @Column({ nullable: true })
  emailVerificationTokenExpires?: Date;

  @Column({ nullable: true })
  resetPasswordToken?: string;

  @Column({ nullable: true })
  resetPasswordTokenExpires?: Date;

  @Column('jsonb', { nullable: true })
  preferences?: {
    defaultCategory?: string;
    searchLimit?: number;
    theme?: 'light' | 'dark';
    language?: string;
  };

  @Column({ default: 0 })
  totalSessions: number;

  @Column({ default: 0 })
  totalSearches: number;

  @Column({ nullable: true })
  @Index()
  lastIpAddress?: string;

  @Column('jsonb', { nullable: true })
  ipAddressHistory?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Session, (session) => session.user, { cascade: true })
  sessions?: Session[];
}
