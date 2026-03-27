/**
 * Auth DTOs
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class RegisterOrLoginDto {
  @ApiPropertyOptional({
    description: 'User email (optional for IP-based registration)',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'User name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({
    description: 'MCP Session ID',
    example: 'session-123456',
  })
  @IsString()
  sessionId: string;
}

export class LoginByEmailDto {
  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'MCP Session ID',
    example: 'session-123456',
  })
  @IsString()
  sessionId: string;
}

export class RegisterWithPasswordDto {
  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password (min 6 characters)',
    example: 'SecurePass123!',
    minLength: 6,
    maxLength: 100,
  })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string;

  @ApiPropertyOptional({
    description: 'User name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({
    description: 'MCP Session ID',
    example: 'session-123456',
  })
  @IsString()
  sessionId: string;
}

export class LoginWithPasswordDto {
  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePass123!',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'MCP Session ID',
    example: 'session-123456',
  })
  @IsString()
  sessionId: string;
}

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token',
    example: 'abc123xyz',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class RequestPasswordResetDto {
  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Frontend URL for redirect',
    example: 'http://localhost:3000',
  })
  @IsString()
  @IsNotEmpty()
  frontendUrl: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token',
    example: 'abc123xyz',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'New password (min 6 characters)',
    example: 'NewSecurePass123!',
    minLength: 6,
    maxLength: 100,
  })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPass123!',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    description: 'New password (min 6 characters)',
    example: 'NewSecurePass123!',
    minLength: 6,
    maxLength: 100,
  })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  newPassword: string;
}

export class LogoutDto {
  @ApiProperty({
    description: 'Session ID to logout',
    example: 'session-123456',
  })
  @IsString()
  sessionId: string;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: 'Default category for search results',
    example: 'nestjs',
  })
  @IsOptional()
  @IsString()
  defaultCategory?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of search results',
    example: 10,
  })
  @IsOptional()
  searchLimit?: number;

  @ApiPropertyOptional({
    description: 'UI theme preference',
    enum: ['light', 'dark'],
    example: 'dark',
  })
  @IsOptional()
  theme?: 'light' | 'dark';

  @ApiPropertyOptional({
    description: 'Language preference',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  language?: string;
}

export class ValidateSessionDto {
  @ApiProperty({
    description: 'Purpose or goal of the session',
    example: 'Search for CQRS architecture rules',
  })
  @IsString()
  purpose: string;
}
