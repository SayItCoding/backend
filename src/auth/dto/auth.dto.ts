import { IsEmail, IsString, MinLength } from 'class-validator';
import { UserProfileDto } from 'src/user/dto/user-profile.dto';

export class SignupDto {
  @IsEmail() email: string;
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(6) password: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

export class LoginResponseDto {
  access_token: string;
  refresh_token: string;
  user: UserProfileDto;
}

export type JwtPayload = {
  sub: number;
  email: string;
  roles?: string[];
  iat?: number;
  exp?: number;
  jti?: string;
};

export type AuthTokens = { access_token: string; refresh_token: string };
