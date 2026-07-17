import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncAgentCommand } from './sync-agent.command';
import { AgentConfigRegistryService } from '@infrastructure/adapters/agent-config/agent-config-registry.service';
import { SddInstallerService } from '@modules/agency-agents/application/services/sdd-installer.service';
import { Logger } from '@nestjs/common';

@CommandHandler(SyncAgentCommand)
export class SyncAgentHandler implements ICommandHandler<SyncAgentCommand> {
  private readonly logger = new Logger(SyncAgentHandler.name);

  constructor(
    private readonly registry: AgentConfigRegistryService,
    private readonly sddInstaller: SddInstallerService,
  ) {}

  async execute(command: SyncAgentCommand) {
    const { agents, components } = command;
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const errors: string[] = [];
    const syncedAgents: string[] = [];

    this.logger.log(`Sync command: agents=${agents.join(', ')}`);

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

      try {
        if (!components || components.includes('sdd')) {
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
      components: components || ['sdd'],
      skills: [],
      errors,
      message: `Synced ${syncedAgents.length} agent(s)`,
    };
  }
}
