import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

/**
 * DTO for Google OAuth login
 * Receives only the Google ID token, backend verifies and extracts user info
 */
export class LoginGoogleDto {
  @IsString()
  @IsNotEmpty()
  googleToken: string;
}

export class SessionLoginDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
