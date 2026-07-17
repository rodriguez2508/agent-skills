/**
 * Agency Created Event
 *
 * Dispatched when a new agency is created.
 */
export class AgencyCreatedEvent {
  constructor(
    public readonly agencyId: string,
    public readonly ownerId: string,
    public readonly slug: string,
    public readonly name: string,
  ) {}
}
