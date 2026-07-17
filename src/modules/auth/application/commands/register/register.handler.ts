import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { RegisterCommand } from './register.command';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  Inject,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.interface';
import {
  RefreshTokenPayload,
  RefreshTokenMetadata,
} from '../../../domain/entities/auth.entity';
import { getJwtConfig } from '../../../const/jwt.constants';
import * as bcrypt from 'bcrypt';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  private readonly logger = new Logger(RegisterHandler.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('RefreshTokenRepository')
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(command: RegisterCommand) {
    try {
      const { registerDto } = command;
      const { email, password, name, avatar } = registerDto;

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user with IP-based method (using a placeholder IP)
      const { user, isNew } = await this.userRepository.findByIpOrCreate({
        ipAddress: `registered:${email}`,
        email,
        name,
        avatar,
        password: hashedPassword,
      });

      if (!isNew) {
        throw new BadRequestException('User already exists');
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

      // Store refresh token
      const ttlSeconds = 7 * 24 * 60 * 60;
      const metadata: RefreshTokenMetadata = { jti, issuedAt: Date.now() };
      await this.refreshTokenRepository.storeRefreshToken(
        user.id,
        metadata,
        ttlSeconds,
      );

      this.logger.log(`✅ User registered: ${user.id} (${email})`);

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
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Registration failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'An unexpected error occurred during registration.',
      );
    }
  }
}
