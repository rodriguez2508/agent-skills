import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { DeleteSkillCommand } from './delete-skill.command';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';

@CommandHandler(DeleteSkillCommand)
export class DeleteSkillHandler implements ICommandHandler<DeleteSkillCommand> {
  private readonly logger = new Logger(DeleteSkillHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(command: DeleteSkillCommand): Promise<void> {
    const skill = await this.repo.findSkillById(command.skillId);
    if (!skill || skill.agencyId !== command.agencyId) {
      throw new Error('Skill no encontrada o no pertenece a esta agencia');
    }
    await this.repo.deleteSkill(command.skillId);
    this.logger.log(`Skill eliminada: ${command.skillId}`);
  }
}
