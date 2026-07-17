import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetUserByIdQuery } from './get-user-by-id.query';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { Logger } from '@nestjs/common';

export interface UserDto {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  active: boolean;
  emailVerified: boolean;
  preferences?: any;
  totalSessions: number;
  totalSearches: number;
  lastIpAddress?: string;
  createdAt: Date;
}

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery, UserDto | null> {
  private readonly logger = new Logger(GetUserByIdHandler.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(query: GetUserByIdQuery): Promise<UserDto | null> {
    const user = await this.userRepository.findById(query.userId);
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
