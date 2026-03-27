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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../../application/services/auth.service';
import {
  RegisterOrLoginDto,
  LoginByEmailDto,
  LogoutDto,
  UpdatePreferencesDto,
  RegisterWithPasswordDto,
  LoginWithPasswordDto,
  VerifyEmailDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from '../../dto/auth.dto';
import { AuthGuard } from '../../guards/auth.guard';
import { User } from '../../decorators/user.decorator';

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

  @Post('register/password')
  @ApiOperation({
    summary: 'Register user with email and password',
    description:
      'Creates a new user with email and password. Sends verification email.',
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully. Verification email sent.',
  })
  @ApiResponse({ status: 400, description: 'User with this email already exists' })
  async registerWithPassword(
    @Body() dto: RegisterWithPasswordDto,
    @Ip() ipAddress: string,
  ) {
    this.logger.log(`🔐 Register with password request from IP: ${ipAddress}`);

    const result = await this.authService.registerWithPassword({
      ...dto,
      ipAddress,
    });

    return {
      message: 'User registered successfully. Please check your email to verify your account.',
      ...result,
    };
  }

  @Post('login/password')
  @ApiOperation({
    summary: 'Login user with email and password',
    description: 'Authenticates an existing user with email and password.',
  })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async loginWithPassword(
    @Body() dto: LoginWithPasswordDto,
    @Ip() ipAddress: string,
  ) {
    this.logger.log(`🔐 Login with password request from IP: ${ipAddress}`);

    const result = await this.authService.loginWithPassword({
      ...dto,
      ipAddress,
    });

    return {
      message: 'User logged in successfully',
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

  @Post('verify-email')
  @ApiOperation({
    summary: 'Verify email with token',
    description: 'Verifies user email using the token sent via email.',
  })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    this.logger.log(`📧 Email verification request`);

    const result = await this.authService.verifyEmail(dto.token);

    return result;
  }

  @Post('password/reset/request')
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Sends a password reset email to the user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent (if email exists)',
  })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    this.logger.log(`🔑 Password reset request for: ${dto.email}`);

    const result = await this.authService.requestPasswordReset(dto);

    return result;
  }

  @Post('password/reset')
  @ApiOperation({
    summary: 'Reset password with token',
    description: 'Resets user password using the token sent via email.',
  })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    this.logger.log(`🔐 Password reset with token`);

    const result = await this.authService.resetPassword(dto);

    return result;
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
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current user info' })
  @ApiResponse({ status: 200, description: 'User info retrieved' })
  @ApiBearerAuth('x-session-id')
  async getCurrentUser(@User() user: any) {
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

  @Post('password/change')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Change password (authenticated)',
    description: 'Changes password for authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Current password is incorrect' })
  async changePassword(
    @User('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    this.logger.log(`🔐 Change password request for user: ${userId}`);

    const result = await this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );

    return result;
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
