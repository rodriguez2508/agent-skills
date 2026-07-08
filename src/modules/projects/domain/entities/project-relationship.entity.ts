import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Project } from './project.entity';

export enum ProjectRelationType {
  GRPC_CLIENT = 'grpc_client',
  DEPENDS_ON = 'depends_on',
  CALLS = 'calls',
  SHARED_DB = 'shared_db',
}

@Entity('project_relationships')
@Unique(['sourceProjectId', 'targetProjectId', 'type'])
export class ProjectRelationship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'source_project_id' })
  @Index()
  sourceProjectId: string;

  @Column({ type: 'uuid', name: 'target_project_id' })
  @Index()
  targetProjectId: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: ProjectRelationType.DEPENDS_ON,
  })
  type: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_project_id' })
  sourceProject?: Project;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_project_id' })
  targetProject?: Project;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
