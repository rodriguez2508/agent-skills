/**
 * Agency Template Entity
 *
 * Represents a publishable template that defines an agency's
 * working methodology: skills, rules, workflow, and persona.
 * Templates can be published to the marketplace for other users.
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
import { Agency } from './agency.entity';

export enum TemplateCategory {
  ARCHITECTURE = 'architecture',
  WORKFLOW = 'workflow',
  PROGRAMMING = 'programming',
  ANALYST = 'analyst',
  FULL_STACK = 'full_stack',
}

@Entity('agency_templates')
export class AgencyTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'agency_id' })
  @Index()
  agencyId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: TemplateCategory.WORKFLOW,
  })
  category: TemplateCategory;

  @Column('jsonb', { nullable: true })
  skills?: string[]; // List of skill names/configs this template uses

  @Column('jsonb', { nullable: true })
  rules?: string[]; // List of rule IDs scoped to this template

  @Column('jsonb', { nullable: true })
  workflow?: {
    steps?: string[];
    defaultStep?: string;
    transitions?: Record<string, string[]>;
    [key: string]: any;
  };

  @Column('jsonb', { nullable: true })
  persona?: {
    systemPrompt?: string;
    constraints?: string[];
    preferences?: Record<string, any>;
    [key: string]: any;
  };

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  @Column({ name: 'download_count', default: 0 })
  downloadCount: number;

  @Column({ name: 'version', type: 'varchar', length: 20, default: '1.0.0' })
  version: string;

  @ManyToOne(() => Agency, (agency) => agency.templates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'agency_id' })
  agency?: Agency;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
