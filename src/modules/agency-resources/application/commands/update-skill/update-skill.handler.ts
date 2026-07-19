import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { UpdateSkillCommand } from './update-skill.command';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencySkillDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@CommandHandler(UpdateSkillCommand)
export class UpdateSkillHandler implements ICommandHandler<UpdateSkillCommand> {
  private readonly logger = new Logger(UpdateSkillHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(command: UpdateSkillCommand): Promise<AgencySkillDto> {
    const skill = await this.repo.findSkillById(command.skillId);
    if (!skill || skill.agencyId !== command.agencyId) {
      throw new Error('Skill no encontrada o no pertenece a esta agencia');
    }
    const updated = await this.repo.updateSkill(command.skillId, command.data);
    this.logger.log(`Skill actualizada: ${updated.name}`);
    return AgencySkillDto.fromEntity(updated);
  }
}
