export class DeleteAgentConfigCommand {
  constructor(
    public readonly agencyId: string,
    public readonly agentId: string,
  ) {}
}
