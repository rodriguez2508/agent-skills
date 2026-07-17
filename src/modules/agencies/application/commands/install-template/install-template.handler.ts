/**
 * Install Template Command Handler
 *
 * Copies a published template's configuration (skills, rules, workflow, persona)
 * into the target agency as a new template. Increments the download counter.
 */

import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InstallTemplateCommand } from './install-template.command';
import { IAgencyRepository } from '@modules/agencies/domain/ports/agency-repository.port';
import { TemplateInstalledEvent } from '@modules/agencies/domain/events/template-installed.event';
import { AgencyTemplate } from '@modules/agencies/domain/entities/agency-template.entity';

export interface InstallTemplateResult {
  template: AgencyTemplate;
}

@CommandHandler(InstallTemplateCommand)
export class InstallTemplateHandler
  implements ICommandHandler<InstallTemplateCommand, InstallTemplateResult>
{
  private readonly logger = new Logger(InstallTemplateHandler.name);

  constructor(
    private readonly agencyRepository: IAgencyRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: InstallTemplateCommand): Promise<InstallTemplateResult> {
    this.logger.log(
      `📥 Installing template ${command.templateId} into agency ${command.targetAgencyId}`,
    );

    // Find the published template
    const sourceTemplate = await this.agencyRepository.findTemplateById(
      command.templateId,
    );

    if (!sourceTemplate) {
      throw new NotFoundException(
        `Template ${command.templateId} not found`,
      );
    }

    if (!sourceTemplate.isPublished) {
      throw new ForbiddenException('Template is not published');
    }

    // Verify target agency exists
    const targetAgency = await this.agencyRepository.findById(
      command.targetAgencyId,
    );
    if (!targetAgency) {
      throw new NotFoundException(
        `Target agency ${command.targetAgencyId} not found`,
      );
    }

    // Clone the template into the target agency
    const cloned = await this.agencyRepository.createTemplate({
      agencyId: command.targetAgencyId,
      name: `${sourceTemplate.name} (forked)`,
      description: sourceTemplate.description,
      category: sourceTemplate.category,
      skills: sourceTemplate.skills,
      rules: sourceTemplate.rules,
      workflow: sourceTemplate.workflow,
      persona: sourceTemplate.persona,
      version: sourceTemplate.version,
    });

    // Increment download counter on source template
    await this.agencyRepository.incrementTemplateDownloads(
      command.templateId,
    );

    this.eventBus.publish(
      new TemplateInstalledEvent(
        command.templateId,
        sourceTemplate.agencyId,
        command.targetAgencyId,
        command.installedByUserId,
      ),
    );

    this.logger.log(
      `✅ Template installed: ${cloned.name} (${cloned.id}) into agency ${command.targetAgencyId}`,
    );
    return { template: cloned };
  }
}
