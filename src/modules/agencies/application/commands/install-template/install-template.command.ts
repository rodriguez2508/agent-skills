/**
 * Install Template Command
 *
 * Installs a published template from the marketplace
 * into the target agency, copying the skills, rules,
 * workflow, and persona configuration.
 */
export class InstallTemplateCommand {
  constructor(
    public readonly templateId: string,
    public readonly targetAgencyId: string,
    public readonly installedByUserId: string,
  ) {}
}
