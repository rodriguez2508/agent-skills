import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetUserBySessionIdQuery } from './get-user-by-session-id.query';
import { SessionRepository } from '@modules/sessions/infrastructure/persistence/session.repository';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { Logger } from '@nestjs/common';
import { UserDto } from '../get-user-by-id/get-user-by-id.handler';

@QueryHandler(GetUserBySessionIdQuery)
export class GetUserBySessionIdHandler
  implements IQueryHandler<GetUserBySessionIdQuery, UserDto | null>
{
  private readonly logger = new Logger(GetUserBySessionIdHandler.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetUserBySessionIdQuery): Promise<UserDto | null> {
    const session = await this.sessionRepository.findBySessionId(query.sessionId);
    if (!session || !session.userId) return null;

    const user = await this.userRepository.findById(session.userId);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      active: user.active,
      emailVerified: user.emailVerified,
      preferences: user.preferences,
      totalSessions: user.totalSessions,
      totalSearches: user.totalSearches,
      lastIpAddress: user.lastIpAddress,
      createdAt: user.createdAt,
    };
  }
}
