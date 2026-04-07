/**
 * Register User Command Handler
 */

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, BadRequestException } from '@nestjs/common';
import { RegisterUserCommand } from './register-user.command';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { SessionRepository } from '@modules/sessions/infrastructure/persistence/session.repository';

export interface RegisterUserResult {
  userId: string;
  sessionId: string;
  isNewUser: boolean;
}

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<
  RegisterUserCommand,
  RegisterUserResult
> {
  private readonly logger = new Logger(RegisterUserHandler.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    this.logger.log(`🔐 Registering user from IP: ${command.ipAddress}`);

    // Find or create user by IP
    const { user, isNew } = await this.userRepository.findByIpOrCreate({
      ipAddress: command.ipAddress,
      email: command.email,
      name: command.name,
      avatar: command.avatar,
    });

    this.logger.log(`👤 User ${isNew ? 'created' : 'found'}: ${user.id}`);

    // Create new session for this user
    const session = await this.sessionRepository.create({
      sessionId: command.sessionId || `session-${Date.now()}`,
      userId: user.id,
      title: command.name ? `Session with ${command.name}` : undefined,
      metadata: {
        ipAddress: command.ipAddress,
      },
    });

    this.logger.log(`📝 Session created: ${session.id}`);

    return {
      userId: user.id,
      sessionId: session.sessionId,
      isNewUser: isNew,
    };
  }
}
