import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { CreateRuleCommand } from './create-rule.command';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencyRuleDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@CommandHandler(CreateRuleCommand)
export class CreateRuleHandler implements ICommandHandler<CreateRuleCommand> {
  private readonly logger = new Logger(CreateRuleHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(command: CreateRuleCommand): Promise<AgencyRuleDto> {
    const rule = await this.repo.createRule({
      agencyId: command.agencyId,
      ...command.data,
    });
    this.logger.log(`Regla creada: ${rule.name} (agency: ${command.agencyId})`);
    return AgencyRuleDto.fromEntity(rule);
  }
}
