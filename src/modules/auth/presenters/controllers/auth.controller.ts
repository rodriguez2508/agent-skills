/**
 * Auth Controller
 *
 * REST API for authentication following CQRS pattern.
 * Supports JWT (web frontend) and Session ID (CLI) auth.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Ip,
  Header,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request, Response } from 'express';

// Commands
import {
  LoginCommand,
  LoginWithGoogleCommand,
  RegisterCommand,
  CompleteRegistrationCommand,
  RefreshTokenCommand,
  LogoutCommand,
  SessionLoginCommand,
} from '../../application/commands';

// Queries
import { VerifyTokenQuery } from '../../application/queries';

// DTOs
import { LoginDto, LoginGoogleDto, SessionLoginDto } from '../../dto/login.dto';
import { RegisterDto } from '../../dto/register.dto';
import { CompleteRegistrationDto } from '../../dto/complete-registration.dto';

// Guards
import { AuthGuard } from '../../guard/auth.guard';

// Utils
import {
  getCookieOptions,
  getClearCookieOptions,
} from '../../utils/cookie-options.util';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ───────────────────────────────
  //  JWT Auth Endpoints (Web)
  // ───────────────────────────────

  @Post('register/complete')
  async registerComplete(
    @Body() dto: CompleteRegistrationDto,
    @Ip() ipAddress: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    this.logger.log(`📝 Complete registration: ${dto.agencyName}`);

    const result = await this.commandBus.execute(
      new CompleteRegistrationCommand(dto, ipAddress),
    );

    // Set refresh token as httpOnly cookie
    response.cookie('refreshToken', result.refreshToken, getCookieOptions(request));

    response.status(201).json({
      accessToken: result.accessToken,
      user: result.user,
      agency: result.agency,
    });
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    this.logger.log(`📝 Register: ${dto.email}`);

    const result = await this.commandBus.execute(new RegisterCommand(dto));

    // Set refresh token as httpOnly cookie
    response.cookie('refreshToken', result.refreshToken, getCookieOptions(request));

    response.status(201).json({
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    this.logger.log(`🔐 Login: ${dto.email}`);

    const result = await this.commandBus.execute(new LoginCommand(dto));

    // Set refresh token as httpOnly cookie
    response.cookie('refreshToken', result.refreshToken, getCookieOptions(request));

    response.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  @Post('login/google')
  async loginGoogle(
    @Body() dto: LoginGoogleDto,
    @Ip() ipAddress: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    this.logger.log(`🔐 Google login from IP: ${ipAddress}`);

    const result = await this.commandBus.execute(
      new LoginWithGoogleCommand(dto, ipAddress),
    );

    // Set refresh token as httpOnly cookie
    response.cookie('refreshToken', result.refreshToken, getCookieOptions(request));

    response.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  @Post('refresh')
  async refresh(@Req() request: Request, @Res() response: Response) {
    const refreshToken = request.cookies?.['refreshToken'];

    this.logger.debug(`Refresh request - Cookie present: ${!!refreshToken}`);

    if (!refreshToken) {
      // Also try body
      const bodyToken = request.body?.refreshToken;
      if (!bodyToken) {
        return response.status(401).json({ message: 'Refresh token not found' });
      }
      const result = await this.commandBus.execute(
        new RefreshTokenCommand(bodyToken),
      );
      return response.json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }

    const result = await this.commandBus.execute(
      new RefreshTokenCommand(refreshToken),
    );

    // Set new refresh token as httpOnly cookie
    response.cookie('refreshToken', result.refreshToken, getCookieOptions(request));

    response.json({ accessToken: result.accessToken });
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res() response: Response) {
    const refreshToken = request.cookies?.['refreshToken'];

    if (refreshToken) {
      await this.commandBus.execute(new LogoutCommand(refreshToken));
    }

    response.clearCookie('refreshToken', getClearCookieOptions(request));
    response.json({ message: 'Logged out successfully' });
  }

  @Post('check-token')
  @Header('Cache-Control', 'no-cache')
  async checkToken(@Body() data: { token: string }) {
    return this.queryBus.execute(new VerifyTokenQuery(data.token));
  }

  // ───────────────────────────────
  //  Session Auth Endpoints (CLI)
  // ───────────────────────────────

  @Post('session/login')
  async sessionLogin(
    @Body() dto: SessionLoginDto,
    @Ip() ipAddress: string,
  ) {
    this.logger.log(`🔐 Session login from IP: ${ipAddress}`);

    const result = await this.commandBus.execute(
      new SessionLoginCommand(ipAddress, dto.name, dto.email),
    );

    return {
      sessionId: result.sessionId,
      userId: result.userId,
      isNewUser: result.isNewUser,
    };
  }

  // ───────────────────────────────
  //  Protected Endpoints
  // ───────────────────────────────

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() request: Request) {
    const user = (request as any)['user'];
    return { user };
  }
}
