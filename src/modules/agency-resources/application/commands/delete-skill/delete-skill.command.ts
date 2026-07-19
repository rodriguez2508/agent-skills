export class DeleteSkillCommand {
  constructor(
    public readonly agencyId: string,
    public readonly skillId: string,
  ) {}
}
