import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LogoutCommand } from './logout.command';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  Inject,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.interface';
import { RefreshTokenPayload } from '../../../domain/entities/auth.entity';
import { getJwtConfig } from '../../../const/jwt.constants';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  private readonly logger = new Logger(LogoutHandler.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('RefreshTokenRepository')
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(command: LogoutCommand) {
    try {
      const { refreshToken } = command;

      // Verify refresh token to get userId
      const refreshPayload = (await this.jwtService.verifyAsync(refreshToken, {
        secret: getJwtConfig(this.configService).refreshSecret,
      })) as RefreshTokenPayload;

      // Delete the refresh token from storage
      await this.refreshTokenRepository.deleteRefreshToken(
        refreshPayload.userId,
      );

      this.logger.log(`✅ User logged out: ${refreshPayload.userId}`);

      return { message: 'Logged out successfully' };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Logout failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error logging out');
    }
  }
}
