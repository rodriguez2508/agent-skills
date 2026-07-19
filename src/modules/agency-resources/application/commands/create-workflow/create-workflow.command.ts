import { CreateAgencyWorkflowData } from '@agency-resources/domain/ports/agency-resources-repository.port';

export class CreateWorkflowCommand {
  constructor(
    public readonly agencyId: string,
    public readonly data: Omit<CreateAgencyWorkflowData, 'agencyId'>,
  ) {}
}
