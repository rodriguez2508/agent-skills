import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { AgentCatalog } from './agent-catalog.entity';
import { Project } from '@modules/projects/domain/entities/project.entity';

@Entity('agent_session_contexts')
@Unique(['agentId', 'sessionId'])
export class AgentSessionContext {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'agent_id', type: 'varchar', length: 100 })
  agentId: string;

  @ManyToOne(() => AgentCatalog, (cat) => cat.sessionContexts, { nullable: true })
  @JoinColumn({ name: 'agent_id', referencedColumnName: 'agentId' })
  agent: AgentCatalog;

  @Index()
  @Column({ name: 'session_id', type: 'varchar', length: 255 })
  sessionId: string;

  @Index()
  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'jsonb', default: [] })
  messages: Array<{ role: string; content: string; timestamp: string }>;

  @Column({ name: 'loaded_skills', type: 'text', array: true, default: [] })
  loadedSkills: string[];

  @Column({ name: 'loaded_rules', type: 'jsonb', default: [] })
  loadedRules: Array<{ id: string; name: string; category: string }>;

  @Column({ name: 'invocation_count', type: 'integer', default: 0 })
  invocationCount: number;

  @Column({ name: 'last_invoked_at', type: 'timestamp', nullable: true })
  lastInvokedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
