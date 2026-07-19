import { CreateAgencyAgentData } from '@agency-resources/domain/ports/agency-resources-repository.port';

export class CreateAgentCommand {
  constructor(
    public readonly agencyId: string,
    public readonly data: Omit<CreateAgencyAgentData, 'agencyId'>,
  ) {}
}
