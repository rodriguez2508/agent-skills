import { CreateAgencyRuleData } from '@agency-resources/domain/ports/agency-resources-repository.port';

export class CreateRuleCommand {
  constructor(
    public readonly agencyId: string,
    public readonly data: Omit<CreateAgencyRuleData, 'agencyId'>,
  ) {}
}
