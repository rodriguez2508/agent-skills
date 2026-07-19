export class UpdateSkillCommand {
  constructor(
    public readonly agencyId: string,
    public readonly skillId: string,
    public readonly data: Record<string, any>,
  ) {}
}
