export class GetWorkflowByIdQuery {
  constructor(
    public readonly agencyId: string,
    public readonly workflowId: string,
  ) {}
}
