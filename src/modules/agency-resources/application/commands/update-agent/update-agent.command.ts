export class UpdateAgentCommand {
  constructor(
    public readonly agencyId: string,
    public readonly agentId: string,
    public readonly data: Record<string, any>,
  ) {}
}
