export class GetSuggestedNextQuery {
  constructor(
    public readonly projectId: string,
    public readonly currentAgentId: string,
  ) {}
}
