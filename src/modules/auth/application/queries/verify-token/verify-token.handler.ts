import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { VerifyTokenQuery } from './verify-token.query';
import { JwtService } from '@nestjs/jwt';
import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

@QueryHandler(VerifyTokenQuery)
export class VerifyTokenHandler implements IQueryHandler<VerifyTokenQuery> {
  constructor(private readonly jwtService: JwtService) {}

  async execute(query: VerifyTokenQuery) {
    const { token } = query;

    try {
      if (!token || token === '' || token === '0') {
        throw new UnauthorizedException('Invalid token');
      }

      // Verify the token
      const decoded = await this.jwtService.verifyAsync(token);

      return {
        isValid: true,
        payload: {
          id: decoded.id,
          email: decoded.email,
          name: decoded.name,
          userType: decoded.userType,
        },
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Error verifying token');
    }
  }
}
