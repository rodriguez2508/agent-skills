export class RecordConfirmationCommand {
  constructor(
    public readonly projectId: string,
    public readonly fromAgentId: string,
    public readonly toAgentId: string,
  ) {}
}
