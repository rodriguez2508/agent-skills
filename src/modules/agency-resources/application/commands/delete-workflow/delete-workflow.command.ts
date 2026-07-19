export class DeleteWorkflowCommand {
  constructor(
    public readonly agencyId: string,
    public readonly workflowId: string,
  ) {}
}
