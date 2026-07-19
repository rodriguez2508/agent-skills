export class GetAgentByIdQuery {
  constructor(
    public readonly agencyId: string,
    public readonly agentId: string,
  ) {}
}
