import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '@modules/projects/domain/entities/project.entity';

@Entity('agent_invocation_patterns')
export class AgentInvocationPattern {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  /** Agente que actuó antes (null = inicio de sesión) */
  @Column({ name: 'from_agent_id', type: 'varchar', length: 100, nullable: true })
  fromAgentId: string | null;

  /** Agente que se invocó a continuación */
  @Index()
  @Column({ name: 'to_agent_id', type: 'varchar', length: 100 })
  toAgentId: string;

  /** Intención que disparó la transición */
  @Column({ type: 'varchar', length: 100, nullable: true })
  intention: string;

  /** Cuántas veces se ha dado esta transición en el proyecto */
  @Column({ type: 'integer', default: 1 })
  count: number;

  /** Veces que el usuario confirmó esta transición (respuesta positiva) */
  @Column({ name: 'confirmed_count', type: 'integer', default: 0 })
  confirmedCount: number;

  /** Veces que el usuario rechazó esta transición */
  @Column({ name: 'rejected_count', type: 'integer', default: 0 })
  rejectedCount: number;

  /** Muestra de inputs que generaron esta transición */
  @Column({ name: 'sample_inputs', type: 'text', array: true, default: [] })
  sampleInputs: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'last_seen_at' })
  lastSeenAt: Date;
}
