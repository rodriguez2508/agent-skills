export class StorePendingNextCommand {
  constructor(
    public readonly sessionId: string,
    public readonly suggestion: { agentId: string; action: string; intention: string; confidence: number; basedOn: string; fromPattern: boolean },
    public readonly fromAgentId: string,
  ) {}
}
