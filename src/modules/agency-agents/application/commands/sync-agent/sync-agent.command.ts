export class SyncAgentCommand {
  constructor(
    public readonly agents: string[],
    public readonly components?: string[],
  ) {}
}
