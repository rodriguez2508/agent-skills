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

@Entity('agency_skills')
@Index(['agencyId', 'name'], { unique: true })
@Index(['agencyId', 'isActive'])
export class AgencySkill {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  agencyId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'text' })
  promptTemplate!: string;

  @Column({ type: 'simple-array', default: '' })
  tags!: string[];

  @Column({ type: 'int', default: 0 })
  usageCount!: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating!: number;

  @Column({ type: 'simple-array', default: '' })
  inputVariables!: string[];

  @Column({ type: 'boolean', default: false })
  isPublished!: boolean;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => Agency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agency_id' })
  agency!: Agency;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
