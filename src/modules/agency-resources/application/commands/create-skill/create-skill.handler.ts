import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { CreateSkillCommand } from './create-skill.command';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencySkillDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@CommandHandler(CreateSkillCommand)
export class CreateSkillHandler implements ICommandHandler<CreateSkillCommand> {
  private readonly logger = new Logger(CreateSkillHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(command: CreateSkillCommand): Promise<AgencySkillDto> {
    const skill = await this.repo.createSkill({
      agencyId: command.agencyId,
      ...command.data,
    });
    this.logger.log(`Skill creada: ${skill.name} (agency: ${command.agencyId})`);
    return AgencySkillDto.fromEntity(skill);
  }
}
