export class DeleteRuleCommand {
  constructor(
    public readonly agencyId: string,
    public readonly ruleId: string,
  ) {}
}
