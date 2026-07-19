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
    const { refreshToken } = command;

    // Try to verify the refresh token to get userId for cleanup.
    // If verification fails (expired, rotated, or secret mismatch),
    // still return success — the cookie will be cleared by the controller.
    try {
      const refreshPayload = (await this.jwtService.verifyAsync(refreshToken, {
        secret: getJwtConfig(this.configService).refreshSecret,
      })) as RefreshTokenPayload;

      await this.refreshTokenRepository.deleteRefreshToken(
        refreshPayload.userId,
      );

      this.logger.log(`User logged out: ${refreshPayload.userId}`);
    } catch (error) {
      this.logger.debug(`Logout cleanup skipped: ${error.message}`);
    }

    return { message: 'Logged out successfully' };
  }
}
