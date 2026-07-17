/**
 * Search Templates Query
 *
 * Searches published templates in the marketplace.
 */
export class SearchTemplatesQuery {
  constructor(
    public readonly query?: string,
    public readonly category?: string,
    public readonly limit?: number,
  ) {}
}
