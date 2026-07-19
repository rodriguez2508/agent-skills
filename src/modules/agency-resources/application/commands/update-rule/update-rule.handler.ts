import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { UpdateRuleCommand } from './update-rule.command';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencyRuleDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@CommandHandler(UpdateRuleCommand)
export class UpdateRuleHandler implements ICommandHandler<UpdateRuleCommand> {
  private readonly logger = new Logger(UpdateRuleHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(command: UpdateRuleCommand): Promise<AgencyRuleDto> {
    const rule = await this.repo.findRuleById(command.ruleId);
    if (!rule || rule.agencyId !== command.agencyId) {
      throw new Error('Regla no encontrada o no pertenece a esta agencia');
    }
    const updated = await this.repo.updateRule(command.ruleId, command.data);
    this.logger.log(`Regla actualizada: ${updated.name}`);
    return AgencyRuleDto.fromEntity(updated);
  }
}
