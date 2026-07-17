/**
 * Create Agency Command Handler
 */

import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { CreateAgencyCommand } from './create-agency.command';
import { IAgencyRepository } from '@modules/agencies/domain/ports/agency-repository.port';
import { AgencyCreatedEvent } from '@modules/agencies/domain/events/agency-created.event';
import { Agency } from '@modules/agencies/domain/entities/agency.entity';

export interface CreateAgencyResult {
  agency: Agency;
  isNew: boolean;
}

@CommandHandler(CreateAgencyCommand)
export class CreateAgencyHandler
  implements ICommandHandler<CreateAgencyCommand, CreateAgencyResult>
{
  private readonly logger = new Logger(CreateAgencyHandler.name);

  constructor(
    private readonly agencyRepository: IAgencyRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateAgencyCommand): Promise<CreateAgencyResult> {
    this.logger.log(`🏢 Creating agency: ${command.name} (${command.slug})`);

    // Check if slug is already taken
    const existing = await this.agencyRepository.findBySlug(command.slug);
    if (existing) {
      throw new Error(`Agency slug "${command.slug}" is already taken`);
    }

    const agency = await this.agencyRepository.create({
      name: command.name,
      slug: command.slug,
      ownerId: command.ownerId,
      description: command.description,
      logo: command.logo,
      settings: command.settings,
    });

    // Add owner as member with OWNER role
    await this.agencyRepository.addMember({
      agencyId: agency.id,
      userId: command.ownerId,
      role: 'owner',
      permissions: {
        canCreateTemplates: true,
        canPublishTemplates: true,
        canManageMembers: true,
        canDeleteAgency: true,
        canConfigureWorkflow: true,
      },
    });

    // Emit domain event
    this.eventBus.publish(
      new AgencyCreatedEvent(agency.id, command.ownerId, agency.slug, agency.name),
    );

    this.logger.log(`✅ Agency created: ${agency.id} (${agency.slug})`);
    return { agency, isNew: true };
  }
}
