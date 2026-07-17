/**
 * Publish Template Command Handler
 */

import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PublishTemplateCommand } from './publish-template.command';
import { IAgencyRepository } from '@modules/agencies/domain/ports/agency-repository.port';
import { TemplatePublishedEvent } from '@modules/agencies/domain/events/template-published.event';
import { AgencyTemplate } from '@modules/agencies/domain/entities/agency-template.entity';

export interface PublishTemplateResult {
  template: AgencyTemplate;
}

@CommandHandler(PublishTemplateCommand)
export class PublishTemplateHandler
  implements ICommandHandler<PublishTemplateCommand, PublishTemplateResult>
{
  private readonly logger = new Logger(PublishTemplateHandler.name);

  constructor(
    private readonly agencyRepository: IAgencyRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: PublishTemplateCommand): Promise<PublishTemplateResult> {
    this.logger.log(`📦 Publishing template: ${command.templateId}`);

    const template = await this.agencyRepository.findTemplateById(
      command.templateId,
    );

    if (!template) {
      throw new NotFoundException(`Template ${command.templateId} not found`);
    }

    if (template.agencyId !== command.agencyId) {
      throw new ForbiddenException(
        'Template does not belong to this agency',
      );
    }

    const updated = await this.agencyRepository.updateTemplate(
      command.templateId,
      {
        isPublished: true,
        price: command.price ?? template.price,
      },
    );

    this.eventBus.publish(
      new TemplatePublishedEvent(
        updated.id,
        updated.agencyId,
        updated.name,
        updated.category,
        updated.price,
      ),
    );

    this.logger.log(`✅ Template published: ${updated.name} (${updated.id})`);
    return { template: updated };
  }
}
