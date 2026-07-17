import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { AgentCategory } from './agent-category.entity';
import { AgentSessionContext } from './agent-session-context.entity';

@Entity('agent_catalog')
export class AgentCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'agent_id', type: 'varchar', length: 100, unique: true })
  agentId: string;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string;

  @ManyToOne(() => AgentCategory, (cat) => cat.agents, { nullable: true, eager: true })
  @JoinColumn({ name: 'category_id' })
  category: AgentCategory;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  purpose: string;

  @Column({ name: 'skill_ids', type: 'text', array: true, default: [] })
  skillIds: string[];

  @Column({ name: 'rule_categories', type: 'text', array: true, default: [] })
  ruleCategories: string[];

  @Column({ name: 'intent_patterns', type: 'text', array: true, default: [] })
  intentPatterns: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 0 })
  priority: number;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => AgentSessionContext, (ctx) => ctx.agent)
  sessionContexts: AgentSessionContext[];
}
