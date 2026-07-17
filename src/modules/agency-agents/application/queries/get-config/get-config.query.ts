export class GetConfigQuery {
  constructor(
    public readonly agencyId: string,
    public readonly agentId: string,
  ) {}
}
