/**
 * Register User Command
 */

export class RegisterUserCommand {
  constructor(
    public readonly ipAddress: string,
    public readonly email?: string,
    public readonly name?: string,
    public readonly avatar?: string,
    public readonly sessionId?: string,
  ) {}
}
