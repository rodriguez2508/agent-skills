export class InstallAgentCommand {
  constructor(
    public readonly agents: string[],
    public readonly components?: string[],
    public readonly skills?: string[],
    public readonly persona?: string,
    public readonly mcpServers?: Record<string, Record<string, unknown>>,
    public readonly dryRun?: boolean,
  ) {}
}
