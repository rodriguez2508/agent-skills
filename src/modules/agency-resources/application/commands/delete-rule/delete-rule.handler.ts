import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { DeleteRuleCommand } from './delete-rule.command';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';

@CommandHandler(DeleteRuleCommand)
export class DeleteRuleHandler implements ICommandHandler<DeleteRuleCommand> {
  private readonly logger = new Logger(DeleteRuleHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(command: DeleteRuleCommand): Promise<void> {
    const rule = await this.repo.findRuleById(command.ruleId);
    if (!rule || rule.agencyId !== command.agencyId) {
      throw new Error('Regla no encontrada o no pertenece a esta agencia');
    }
    await this.repo.deleteRule(command.ruleId);
    this.logger.log(`Regla eliminada: ${command.ruleId}`);
  }
}
