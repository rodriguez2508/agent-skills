/**
 * User Decorator
 *
 * Extracts the authenticated user from the request.
 * Use in conjunction with AuthGuard.
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

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

export const User = createParamDecorator(
  (data: keyof UserDto | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request['user'] as UserDto | undefined;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
