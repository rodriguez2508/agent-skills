/**
 * Publish Template Command
 */
export class PublishTemplateCommand {
  constructor(
    public readonly templateId: string,
    public readonly agencyId: string,
    public readonly price?: number,
  ) {}
}
