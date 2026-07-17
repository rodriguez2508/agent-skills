import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { LoginCommand } from './login.command';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  Inject,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.interface';
import {
  RefreshTokenPayload,
  RefreshTokenMetadata,
} from '../../../domain/entities/auth.entity';
import { getJwtConfig } from '../../../const/jwt.constants';
import * as bcrypt from 'bcrypt';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  private readonly logger = new Logger(LoginHandler.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('RefreshTokenRepository')
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(command: LoginCommand) {
    try {
      const { loginDto } = command;
      const { email, password } = loginDto;

      // Find user by email with password
      const user = await this.userRepository.findByEmailWithPassword(email);
      if (!user || !user.password) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Generate access token
      const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        userType: 'user',
        lastIpAddress: user.lastIpAddress,
        lastConnected: new Date(),
      };
      const accessToken = await this.jwtService.signAsync(payload);

      // Generate refresh token
      const jti = randomUUID();
      const refreshPayload: RefreshTokenPayload = {
        userId: user.id,
        userType: 'user',
        jti,
      };
      const refreshToken = await this.jwtService.signAsync(
        refreshPayload as unknown as Record<string, unknown>,
        {
          secret: getJwtConfig(this.configService).refreshSecret,
          expiresIn: getJwtConfig(this.configService).refreshExpiresIn as any,
        },
      );

      // Store refresh token in Redis
      const ttlSeconds = 7 * 24 * 60 * 60; // 7 days
      const metadata: RefreshTokenMetadata = { jti, issuedAt: Date.now() };
      await this.refreshTokenRepository.storeRefreshToken(
        user.id,
        metadata,
        ttlSeconds,
      );

      this.logger.log(`✅ User logged in: ${user.id} (${email})`);

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Login failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'An unexpected error occurred during login.',
      );
    }
  }
}
