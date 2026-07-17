import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InstallAgentCommand } from './install-agent.command';
import { AgentConfigRegistryService } from '@infrastructure/adapters/agent-config/agent-config-registry.service';
import { SddInstallerService } from '@modules/agency-agents/application/services/sdd-installer.service';
import { SkillsInstallerService } from '@modules/agency-agents/application/services/skills-installer.service';
import { McpInstallerService } from '@modules/agency-agents/application/services/mcp-installer.service';
import { PersonaInstallerService } from '@modules/agency-agents/application/services/persona-installer.service';
import { Logger } from '@nestjs/common';

@CommandHandler(InstallAgentCommand)
export class InstallAgentHandler implements ICommandHandler<InstallAgentCommand> {
  private readonly logger = new Logger(InstallAgentHandler.name);

  constructor(
    private readonly registry: AgentConfigRegistryService,
    private readonly sddInstaller: SddInstallerService,
    private readonly skillsInstaller: SkillsInstallerService,
    private readonly mcpInstaller: McpInstallerService,
    private readonly personaInstaller: PersonaInstallerService,
  ) {}

  async execute(command: InstallAgentCommand) {
    const { agents, components, skills, persona, mcpServers, dryRun } = command;
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const errors: string[] = [];
    const installedAgents: string[] = [];
    const installedComponents: string[] = [];
    const installedSkills: string[] = [];

    this.logger.log(`Install command: agents=${agents.join(', ')}, dryRun=${dryRun ?? false}`);

    if (dryRun) {
      this.logger.log(`[DRY RUN] Planning installation for agents: ${agents.join(', ')}`);
    }

    for (const agentId of agents) {
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
        if (!components || components.includes('sdd')) {
          await this.sddInstaller.install(adapter, homeDir);
          if (!installedComponents.includes('sdd')) installedComponents.push('sdd');
        }

        if (skills && skills.length > 0) {
          await this.skillsInstaller.install(adapter, homeDir, skills);
          installedSkills.push(...skills);
        }

        if (!components || components.includes('mcp')) {
          if (mcpServers && Object.keys(mcpServers).length > 0) {
            await this.mcpInstaller.installServers(adapter, homeDir, mcpServers);
          } else {
            await this.mcpInstaller.installDefaultServer(adapter, homeDir);
          }
          if (!installedComponents.includes('mcp')) installedComponents.push('mcp');
        }

        if (persona) {
          await this.personaInstaller.install(adapter, homeDir, persona);
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
      persona,
      errors,
      message: dryRun
        ? `Dry run: would install into ${installedAgents.length} agent(s)`
        : `Installed into ${installedAgents.length} agent(s)`,
    };
  }
}
