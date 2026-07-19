export class DeleteAgentCommand {
  constructor(
    public readonly agencyId: string,
    public readonly agentId: string,
  ) {}
}
