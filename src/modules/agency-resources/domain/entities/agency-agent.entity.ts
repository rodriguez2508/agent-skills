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

@Entity('agency_agents')
@Index(['agencyId', 'name'], { unique: true })
@Index(['agencyId', 'isActive'])
export class AgencyAgent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'agency_id' })
  agencyId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'text', name: 'system_prompt' })
  systemPrompt!: string;

  @Column({ type: 'simple-array', default: '' })
  tools!: string[];

  @Column({
    type: 'enum',
    enum: ['conversational', 'task', 'hybrid'],
    default: 'conversational',
  })
  type!: string;

  @Column({ type: 'simple-array', name: 'skill_ids', default: '' })
  skillIds!: string[];

  @Column({ type: 'simple-array', name: 'rule_ids', default: '' })
  ruleIds!: string[];

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
