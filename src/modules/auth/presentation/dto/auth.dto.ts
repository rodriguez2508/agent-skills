/**
 * Auth DTOs
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

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
