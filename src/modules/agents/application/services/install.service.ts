import { Injectable, Logger } from '@nestjs/common';
import { AgentConfigRegistryService } from '@infrastructure/adapters/agent-config/agent-config-registry.service';
import { SddInstallerService } from './sdd-installer.service';
import { SkillsInstallerService } from './skills-installer.service';
import { McpInstallerService } from './mcp-installer.service';
import { PersonaInstallerService } from './persona-installer.service';
import { InstallationProfile } from '@modules/agents/domain/entities/installation-profile.entity';

/**
 * Result of an install operation.
 */
export interface InstallResult {
  success: boolean;
  dryRun: boolean;
  agents: string[];
  components: string[];
  skills: string[];
  persona?: string;
  errors: string[];
  message: string;
}

/**
 * Input for the install operation.
 */
export interface InstallInput {
  agents: string[];
  components?: string[];
  skills?: string[];
  persona?: string;
  mcpServers?: Record<string, Record<string, unknown>>;
  dryRun?: boolean;
}

/**
 * Orchestrator service for installing the Gentle AI ecosystem.
 * Coordinates all component installers across selected agents.
 */
@Injectable()
export class InstallService {
  private readonly logger = new Logger(InstallService.name);

  constructor(
    private readonly registry: AgentConfigRegistryService,
    private readonly sddInstaller: SddInstallerService,
    private readonly skillsInstaller: SkillsInstallerService,
    private readonly mcpInstaller: McpInstallerService,
    private readonly personaInstaller: PersonaInstallerService,
  ) {}

  /**
   * Executes the installation process.
   */
  async execute(input: InstallInput): Promise<InstallResult> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const errors: string[] = [];
    const installedAgents: string[] = [];
    const installedComponents: string[] = [];
    const installedSkills: string[] = [];

    const dryRun = input.dryRun ?? false;

    if (dryRun) {
      this.logger.log(`[DRY RUN] Planning installation for agents: ${input.agents.join(', ')}`);
    }

    // Validate agents
    for (const agentId of input.agents) {
      const adapter = this.registry.getAdapter(agentId);
      if (!adapter) {
        errors.push(`Unknown agent: ${agentId}`);
        continue;
      }

      const detection = await adapter.detect(homeDir);
      if (!detection.installed) {
        errors.push(`Agent not installed: ${agentId}`);
        continue;
      }

      if (dryRun) {
        this.logger.log(`[DRY RUN] Would install into: ${agentId} (${detection.version || 'unknown version'})`);
        installedAgents.push(agentId);
        continue;
      }

      try {
        // Install SDD if requested
        if (!input.components || input.components.includes('sdd')) {
          await this.sddInstaller.install(adapter, homeDir);
          if (!installedComponents.includes('sdd')) installedComponents.push('sdd');
        }

        // Install individual skills if requested
        if (input.skills && input.skills.length > 0) {
          await this.skillsInstaller.install(adapter, homeDir, input.skills);
          installedSkills.push(...input.skills);
        }

        // Install MCP server config (default or custom)
        if (!input.components || input.components.includes('mcp')) {
          if (input.mcpServers && Object.keys(input.mcpServers).length > 0) {
            await this.mcpInstaller.installServers(adapter, homeDir, input.mcpServers);
          } else {
            // Install default agent-skills-api MCP server
            await this.mcpInstaller.installDefaultServer(adapter, homeDir);
          }
          if (!installedComponents.includes('mcp')) installedComponents.push('mcp');
        }

        // Install persona if requested
        if (input.persona) {
          await this.personaInstaller.install(adapter, homeDir, input.persona);
        }

        installedAgents.push(agentId);
        this.logger.log(`✅ Installation complete for: ${agentId}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to install into ${agentId}: ${msg}`);
        this.logger.error(`❌ Installation failed for ${agentId}: ${msg}`);
      }
    }

    return {
      success: errors.length === 0,
      dryRun,
      agents: installedAgents,
      components: installedComponents,
      skills: [...new Set(installedSkills)],
      persona: input.persona,
      errors,
      message: dryRun
        ? `Dry run: would install into ${installedAgents.length} agent(s)`
        : `Installed into ${installedAgents.length} agent(s)`,
    };
  }

  /**
   * Syncs managed assets to current version (idempotent).
   */
  async sync(input: { agents: string[]; components?: string[] }): Promise<InstallResult> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const errors: string[] = [];
    const syncedAgents: string[] = [];

    for (const agentId of input.agents) {
      const adapter = this.registry.getAdapter(agentId);
      if (!adapter) {
        errors.push(`Unknown agent: ${agentId}`);
        continue;
      }

      const detection = await adapter.detect(homeDir);
      if (!detection.installed) {
        errors.push(`Agent not installed: ${agentId}`);
        continue;
      }

      try {
        // Sync SDD
        if (!input.components || input.components.includes('sdd')) {
          await this.sddInstaller.sync(adapter, homeDir);
        }

        syncedAgents.push(agentId);
        this.logger.debug(`Synced: ${agentId}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to sync ${agentId}: ${msg}`);
      }
    }

    return {
      success: errors.length === 0,
      dryRun: false,
      agents: syncedAgents,
      components: input.components || ['sdd'],
      skills: [],
      errors,
      message: `Synced ${syncedAgents.length} agent(s)`,
    };
  }
}
