/**
 * Template Installed Event
 *
 * Dispatched when a user installs a template from the marketplace
 * into their own agency.
 */
export class TemplateInstalledEvent {
  constructor(
    public readonly templateId: string,
    public readonly sourceAgencyId: string,
    public readonly targetAgencyId: string,
    public readonly installedByUserId: string,
  ) {}
}
