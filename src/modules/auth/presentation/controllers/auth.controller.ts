/**
 * Auth Controller
 *
 * Handles user authentication and session management.
 * Users are grouped by IP address.
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Headers,
  Ip,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AuthService } from '../../application/services/auth.service';
import {
  RegisterOrLoginDto,
  LoginByEmailDto,
  LogoutDto,
  UpdatePreferencesDto,
  ValidateSessionDto,
} from '../../presentation/dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register or login user by IP',
    description:
      'Creates a new user grouped by IP address or returns existing user for that IP. Also creates a new session.',
  })
  @ApiResponse({
    status: 201,
    description: 'User registered/logged in successfully',
  })
  async registerOrLogin(
    @Body() dto: RegisterOrLoginDto,
    @Ip() ipAddress: string,
  ) {
    this.logger.log(`🔐 Register/Login request from IP: ${ipAddress}`);

    const result = await this.authService.registerOrLogin({
      ipAddress,
      email: dto.email,
      name: dto.name,
      avatar: dto.avatar,
      sessionId: dto.sessionId,
    });

    return {
      message: result.isNewUser
        ? 'User registered successfully'
        : 'User logged in successfully',
      ...result,
    };
  }

  @Post('login')
  @ApiOperation({
    summary: 'Login user by email',
    description: 'Authenticates an existing user by email and creates a new session.',
  })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  @ApiResponse({ status: 400, description: 'User not found or inactive' })
  async login(@Body() dto: LoginByEmailDto, @Ip() ipAddress: string) {
    this.logger.log(`🔐 Login request for email: ${dto.email} from IP: ${ipAddress}`);

    const result = await this.authService.loginByEmail({
      email: dto.email,
      ipAddress,
      sessionId: dto.sessionId,
    });

    return {
      message: 'User logged in successfully',
      ...result,
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: LogoutDto) {
    this.logger.log(`🔓 Logout request for session: ${dto.sessionId}`);

    await this.authService.logout(dto.sessionId);

    return { message: 'User logged out successfully' };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user info' })
  @ApiResponse({ status: 200, description: 'User info retrieved' })
  async getCurrentUser(@Headers('x-session-id') sessionId: string) {
    if (!sessionId) {
      return { error: 'Session ID required in x-session-id header' };
    }

    const user = await this.authService.getUserBySessionId(sessionId);

    if (!user) {
      return { error: 'User not found for this session' };
    }

    return { user };
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User info retrieved' })
  async getUserById(@Param('userId') userId: string) {
    const user = await this.authService.getUserById(userId);

    if (!user) {
      return { error: 'User not found' };
    }

    return { user };
  }

  @Get('users/:userId/sessions')
  @ApiOperation({ summary: 'Get active sessions for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved' })
  async getActiveSessions(@Param('userId') userId: string) {
    const sessions = await this.authService.getActiveSessions(userId);

    return { sessions };
  }

  @Post('users/:userId/preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  async updatePreferences(
    @Param('userId') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    const user = await this.authService.updatePreferences(userId, dto);

    return { message: 'Preferences updated successfully', user };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStats() {
    const stats = await this.authService.getStats();

    return {
      stats,
      message: `${stats.totalUsers} total users, ${stats.activeUsers} active, grouped by ${stats.usersByIp} unique IPs`,
    };
  }

  @Get('sessions/stats')
  @ApiOperation({ summary: 'Get session statistics' })
  @ApiResponse({ status: 200, description: 'Session statistics retrieved' })
  async getSessionStats() {
    const stats = await this.authService.getSessionStats();

    return {
      stats,
      message: `${stats.totalSessions} total sessions, ${stats.activeSessions} active, ${stats.totalMessages} messages`,
    };
  }

  @Post('sessions/:sessionId/validate')
  @ApiOperation({ summary: 'Validate a session with a purpose' })
  @ApiParam({ name: 'sessionId', description: 'Session ID to validate' })
  @ApiResponse({ status: 200, description: 'Session validated' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async validateSession(
    @Param('sessionId') sessionId: string,
    @Body() dto: ValidateSessionDto,
  ) {
    this.logger.log(`✅ Validate session request: ${sessionId}`);

    const session = await this.authService.validateSession(sessionId, dto.purpose);

    return {
      message: 'Session validated successfully',
      session,
    };
  }

  @Post('sessions/:sessionId/invalidate')
  @ApiOperation({ summary: 'Invalidate a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID to invalidate' })
  @ApiResponse({ status: 200, description: 'Session invalidated' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async invalidateSession(
    @Param('sessionId') sessionId: string,
    @Body('reason') reason?: string,
  ) {
    this.logger.log(`🚫 Invalidate session request: ${sessionId}`);

    const session = await this.authService.invalidateSession(sessionId, reason);

    return {
      message: 'Session invalidated successfully',
      session,
    };
  }

  @Delete('sessions/cleanup')
  @ApiOperation({ summary: 'Force cleanup of expired sessions' })
  @ApiResponse({ status: 200, description: 'Cleanup completed' })
  async forceCleanup() {
    this.logger.log('🧹 Force cleanup requested');

    const result = await this.authService.forceSessionCleanup();

    return {
      message: 'Cleanup completed',
      result,
    };
  }
}
