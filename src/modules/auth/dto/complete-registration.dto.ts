import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CompleteRegistrationDto {
  @IsString()
  @IsNotEmpty()
  googleToken: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  agencyName: string;

  @IsOptional()
  @IsString()
  agencySlug?: string;

  @IsOptional()
  @IsString()
  planTier?: string;
}
