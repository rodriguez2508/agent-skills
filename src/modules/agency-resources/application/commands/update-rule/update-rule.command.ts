export class UpdateRuleCommand {
  constructor(
    public readonly agencyId: string,
    public readonly ruleId: string,
    public readonly data: Record<string, any>,
  ) {}
}
