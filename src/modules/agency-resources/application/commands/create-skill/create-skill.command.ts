import { CreateAgencySkillData } from '@agency-resources/domain/ports/agency-resources-repository.port';

export class CreateSkillCommand {
  constructor(
    public readonly agencyId: string,
    public readonly data: Omit<CreateAgencySkillData, 'agencyId'>,
  ) {}
}
