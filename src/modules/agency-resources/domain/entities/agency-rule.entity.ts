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

@Entity('agency_rules')
@Index(['agencyId', 'name'], { unique: true })
@Index(['agencyId', 'category'])
@Index(['agencyId', 'priority'])
export class AgencyRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'agency_id' })
  agencyId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({
    type: 'enum',
    enum: ['guardrail', 'policy', 'quality', 'workflow', 'custom'],
    default: 'custom',
  })
  category!: string;

  @Column({ type: 'text', name: 'rule_content' })
  ruleContent!: string;

  @Column({
    type: 'enum',
    name: 'enforcement_level',
    enum: ['soft', 'hard'],
    default: 'soft',
  })
  enforcementLevel!: string;

  @Column({ type: 'int', default: 0 })
  priority!: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @ManyToOne(() => Agency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agency_id' })
  agency!: Agency;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
