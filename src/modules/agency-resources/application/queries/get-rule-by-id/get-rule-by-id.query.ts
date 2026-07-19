export class GetRuleByIdQuery {
  constructor(
    public readonly agencyId: string,
    public readonly ruleId: string,
  ) {}
}
