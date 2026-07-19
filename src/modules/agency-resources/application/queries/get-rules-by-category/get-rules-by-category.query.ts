export class GetRulesByCategoryQuery {
  constructor(
    public readonly agencyId: string,
    public readonly category: string,
  ) {}
}
