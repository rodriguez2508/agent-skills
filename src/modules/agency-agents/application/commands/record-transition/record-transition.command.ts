export class RecordTransitionCommand {
  constructor(
    public readonly projectId: string,
    public readonly fromAgentId: string | null,
    public readonly toAgentId: string,
    public readonly intention: string,
    public readonly sampleInput: string,
  ) {}
}
