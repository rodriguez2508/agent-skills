import { AgentConfig } from '@modules/agency-agents/domain/entities/agent-config.entity';

export class CreateAgentConfigCommand {
  constructor(
    public readonly agencyId: string,
    public readonly data: Partial<AgentConfig> & { agentId: string; name: string },
  ) {}
}
