export class UpdateWorkflowCommand {
  constructor(
    public readonly agencyId: string,
    public readonly workflowId: string,
    public readonly data: Record<string, any>,
  ) {}
}
