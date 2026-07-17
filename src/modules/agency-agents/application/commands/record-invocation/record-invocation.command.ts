export class RecordInvocationCommand {
  constructor(
    public readonly agentId: string,
    public readonly sessionId: string,
    public readonly projectId: string | undefined,
    public readonly userMessage: string,
    public readonly assistantResponse: string,
    public readonly appliedRules: Array<{ id: string; name: string; category: string }>,
  ) {}
}
