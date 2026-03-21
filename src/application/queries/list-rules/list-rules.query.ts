export class ListRulesQuery {
  constructor(
    public readonly category?: string,
    public readonly limit: number = 50,
  ) {}
}
