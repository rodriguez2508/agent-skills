/**
 * Template Published Event
 *
 * Dispatched when an agency publishes a template to the marketplace.
 */
export class TemplatePublishedEvent {
  constructor(
    public readonly templateId: string,
    public readonly agencyId: string,
    public readonly name: string,
    public readonly category: string,
    public readonly price: number,
  ) {}
}
