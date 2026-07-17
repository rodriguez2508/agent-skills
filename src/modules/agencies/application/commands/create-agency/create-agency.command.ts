/**
 * Create Agency Command
 */
export class CreateAgencyCommand {
  constructor(
    public readonly name: string,
    public readonly slug: string,
    public readonly ownerId: string,
    public readonly description?: string,
    public readonly logo?: string,
    public readonly settings?: Record<string, any>,
  ) {}
}
