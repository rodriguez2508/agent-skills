import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Agency Agent Configuration
 *
 * Stores agent CLI tool configurations per agency.
 * Replaces hardcoded adapters (Qwen, Claude, OpenCode) with DB-stored configs
 * that each agency can customize.
 */
@Entity('agency_agent_configs')
export class AgentConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agency_id', type: 'varchar', nullable: true })
  agencyId: string | null;

  /** Unique agent identifier (e.g., 'qwen-cli', 'claude-code', 'opencode') */
  @Column({ name: 'agent_id', type: 'varchar' })
  agentId: string;

  /** Display name */
  @Column()
  name: string;

  /** CLI binary name (e.g., 'qwen', 'claude') */
  @Column({ name: 'binary_name', type: 'varchar', nullable: true })
  binaryName: string | null;

  /** Description of what this agent does */
  @Column({ nullable: true, type: 'text' })
  description: string | null;

  /** Config directory pattern (e.g., '~/.qwen') */
  @Column({ name: 'config_dir' })
  configDir: string;

  /** System prompt file pattern (e.g., '~/.qwen/INSTRUCTIONS.md') */
  @Column({ name: 'system_prompt_file' })
  systemPromptFile: string;

  /** Skills directory pattern (e.g., '~/.qwen/skills') */
  @Column({ name: 'skills_dir' })
  skillsDir: string;

  /** Settings file pattern (e.g., '~/.qwen/settings.json') */
  @Column({ name: 'settings_path' })
  settingsPath: string;

  /** MCP config path template (e.g., '~/.qwen/mcp/{serverName}.json') */
  @Column({ name: 'mcp_config_path', type: 'varchar', nullable: true })
  mcpConfigPath: string | null;

  /** SystemPromptStrategy enum value (0=MarkdownSections, 1=FileReplace, 2=AppendToFile) */
  @Column({ name: 'system_prompt_strategy', type: 'int', default: 2 })
  systemPromptStrategy: number;

  /** MCPStrategy enum value (0=SeparateFiles, 1=MergeIntoSettings, 2=MCPConfigFile, 3=TOMLFile) */
  @Column({ name: 'mcp_strategy', type: 'int', default: 1 })
  mcpStrategy: number;

  /** Whether this agent supports skill installation */
  @Column({ name: 'supports_skills', default: true })
  supportsSkills: boolean;

  /** Whether this agent supports system prompt injection */
  @Column({ name: 'supports_system_prompt', default: true })
  supportsSystemPrompt: boolean;

  /** Whether this agent supports MCP server configuration */
  @Column({ name: 'supports_mcp', default: true })
  supportsMCP: boolean;

  /** Support tier */
  @Column({ default: 'full' })
  tier: string;

  /** Whether this config is active */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Whether this is a default config (available to all agencies) */
  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
