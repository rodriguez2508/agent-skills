import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { SessionLoginCommand } from './session-login.command';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { SessionRepository } from '@modules/sessions/infrastructure/persistence/session.repository';

export interface SessionLoginResult {
  userId: string;
  sessionId: string;
  isNewUser: boolean;
}

@CommandHandler(SessionLoginCommand)
export class SessionLoginHandler
  implements ICommandHandler<SessionLoginCommand, SessionLoginResult>
{
  private readonly logger = new Logger(SessionLoginHandler.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async execute(command: SessionLoginCommand): Promise<SessionLoginResult> {
    const { ipAddress, name, email, sessionId } = command;

    this.logger.log(`🔐 Session login from IP: ${ipAddress}`);

    // Find or create user by IP
    const { user, isNew } = await this.userRepository.findByIpOrCreate({
      ipAddress,
      email,
      name,
    });

    // Create session
    const session = await this.sessionRepository.create({
      sessionId: sessionId || `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      userId: user.id,
      title: name ? `Session for ${name}` : undefined,
      metadata: {
        ipAddress,
        authMethod: 'session-id',
      },
    });

    this.logger.log(
      `✅ Session login: user=${user.id}, session=${session.sessionId}, new=${isNew}`,
    );

    return {
      userId: user.id,
      sessionId: session.sessionId,
      isNewUser: isNew,
    };
  }
}
