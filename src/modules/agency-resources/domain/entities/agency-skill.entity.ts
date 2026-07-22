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
import { Agency } from '../../../agencies/domain/entities/agency.entity';
import { AgentCategory } from '@modules/agency-agents/domain/entities/agent-category.entity';

@Entity('agency_skills')
@Index(['agencyId', 'name'], { unique: true })
@Index(['agencyId', 'isActive'])
export class AgencySkill {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'agency_id' })
  agencyId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'text', name: 'prompt_template' })
  promptTemplate!: string;

  @Column({ type: 'uuid', name: 'category_id', nullable: true })
  categoryId!: string | null;

  @ManyToOne(() => AgentCategory, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category!: AgentCategory | null;

  @Column({ type: 'simple-array', default: '' })
  tags!: string[];

  @Column({ type: 'int', name: 'usage_count', default: 0 })
  usageCount!: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating!: number;

  @Column({ type: 'simple-array', name: 'input_variables', default: '' })
  inputVariables!: string[];

  @Column({ type: 'boolean', name: 'is_published', default: false })
  isPublished!: boolean;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', name: 'is_permanent', default: false })
  isPermanent!: boolean;

  @ManyToOne(() => Agency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agency_id' })
  agency!: Agency;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
