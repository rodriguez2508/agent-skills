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

@Entity('agency_workflows')
@Index(['agencyId', 'name'], { unique: true })
@Index(['agencyId', 'isActive'])
export class AgencyWorkflow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'agency_id' })
  agencyId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'jsonb' })
  steps!: any;

  @Column({ type: 'varchar', length: 30, name: 'trigger_type', default: 'sequential' })
  triggerType!: string;

  @Column({ type: 'jsonb', name: 'trigger_config', default: '{}' })
  triggerConfig!: any;

  @Column({ type: 'int', name: 'execution_count', default: 0 })
  executionCount!: number;

  @Column({ type: 'int', name: 'success_count', default: 0 })
  successCount!: number;

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
