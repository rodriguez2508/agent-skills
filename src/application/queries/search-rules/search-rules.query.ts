export class SearchRulesQuery {
  constructor(
    public readonly query: string,
    public readonly category?: string,
    public readonly limit: number = 10,
  ) {}
}
