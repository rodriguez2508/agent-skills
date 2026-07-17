import { AgentConfig } from '@modules/agency-agents/domain/entities/agent-config.entity';

export class UpdateAgentConfigCommand {
  constructor(
    public readonly agencyId: string,
    public readonly agentId: string,
    public readonly data: Partial<AgentConfig>,
  ) {}
}
