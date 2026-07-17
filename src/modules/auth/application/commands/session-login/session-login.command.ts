export class SessionLoginCommand {
  constructor(
    public readonly ipAddress: string,
    public readonly name?: string,
    public readonly email?: string,
    public readonly sessionId?: string,
  ) {}
}
