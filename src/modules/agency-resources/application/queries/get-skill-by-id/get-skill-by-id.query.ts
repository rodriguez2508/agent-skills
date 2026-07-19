export class GetSkillByIdQuery {
  constructor(
    public readonly agencyId: string,
    public readonly skillId: string,
  ) {}
}
