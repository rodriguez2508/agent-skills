export class SetLastAgentCommand {
  constructor(
    public readonly sessionId: string,
    public readonly agentId: string,
  ) {}
}
