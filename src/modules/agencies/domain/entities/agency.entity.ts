/**
 * Agency Entity
 *
 * Represents a workspace/agency within the multi-tenancy system.
 * Each agency has its own skills, rules, workflows, and members.
 *
 * Hierarchy:
 * User (owner) → Agency → AgencyMember → AgencyTemplate
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
import { AgencyMember } from './agency-member.entity';
import { AgencyTemplate } from './agency-template.entity';
import { AgencySkill } from '@agency-resources/domain/entities/agency-skill.entity';
import { AgencyRule } from '@agency-resources/domain/entities/agency-rule.entity';
import { AgencyAgent } from '@agency-resources/domain/entities/agency-agent.entity';
import { AgencyWorkflow } from '@agency-resources/domain/entities/agency-workflow.entity';

export enum AgencyPlanTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

@Entity('agencies')
export class Agency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  slug: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo?: string;

  @Column({ type: 'uuid', name: 'owner_id' })
  @Index()
  ownerId: string;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'plan_tier',
    default: AgencyPlanTier.FREE,
  })
  @Index()
  planTier: AgencyPlanTier;

  @Column({ type: 'varchar', length: 100, name: 'stripe_customer_id', nullable: true })
  stripeCustomerId?: string;

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @Column('jsonb', { nullable: true })
  settings?: {
    defaultWorkflow?: string;
    defaultLanguage?: string;
    maxMembers?: number;
    maxTemplates?: number;
    features?: string[];
    [key: string]: any;
  };

  @OneToMany(() => AgencyMember, (member) => member.agency, { cascade: true })
  members?: AgencyMember[];

  @OneToMany(() => AgencyTemplate, (template) => template.agency, {
    cascade: true,
  })
  templates?: AgencyTemplate[];

  @OneToMany(() => AgencySkill, (skill) => skill.agency, { cascade: true })
  skills?: AgencySkill[];

  @OneToMany(() => AgencyRule, (rule) => rule.agency, { cascade: true })
  rules?: AgencyRule[];

  @OneToMany(() => AgencyAgent, (agent) => agent.agency, { cascade: true })
  agents?: AgencyAgent[];

  @OneToMany(() => AgencyWorkflow, (workflow) => workflow.agency, { cascade: true })
  workflows?: AgencyWorkflow[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
