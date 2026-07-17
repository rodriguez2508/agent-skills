export class RecordRejectionCommand {
  constructor(
    public readonly projectId: string,
    public readonly fromAgentId: string,
    public readonly toAgentId: string,
  ) {}
}
