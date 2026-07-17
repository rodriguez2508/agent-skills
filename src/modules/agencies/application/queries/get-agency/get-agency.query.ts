/**
 * Get Agency Query
 */
export class GetAgencyQuery {
  constructor(
    public readonly identifier: string,
    public readonly bySlug?: boolean,
  ) {}
}
