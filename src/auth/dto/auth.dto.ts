import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail() email: string;
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(6) password: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

export type JwtPayload = {
  sub: number;
  email: string;
  roles?: string[];
  iat?: number;
  exp?: number;
  jti?: string;
};

export type AuthTokens = { access_token: string; refresh_token?: string };
