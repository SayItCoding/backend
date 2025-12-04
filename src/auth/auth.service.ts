import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { UserService } from '../user/user.service';
import {
  LoginDto,
  SignupDto,
  AuthTokens,
  LoginResponseDto,
} from './dto/auth.dto';
import { UserProfileDto } from 'src/user/dto/user-profile.dto';
import { parseToSeconds } from '../utils/jwt-exp';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthTokens> {
    const exists = await this.userService.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email already registered');

    const user = await this.userService.create({ ...dto, roles: ['user'] });
    return this.issueTokens(user.id, user.email, user.roles);
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userService.findByEmail(dto.email);
    // 유저 열거 방지: 동일 메시지
    if (!user || !(await user.comparePassword(dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 토큰 발급 (기존 로직 그대로 재사용)
    const tokens = await this.issueTokens(user.id, user.email, user.roles);
    // tokens: { access_token, refresh_token }

    // 유저 엔티티 → 응답용 DTO로 변환
    const userProfile = plainToInstance(UserProfileDto, user, {
      excludeExtraneousValues: true, // @Expose 된 필드만
    });

    // 토큰 + 유저정보 합쳐서 반환
    return {
      ...tokens,
      user: userProfile,
    };
  }

  /** 액세스(짧게) + 리프레시(길게) 둘 다 발급 예시 */
  private async issueTokens(
    sub: number,
    email: string,
    roles?: string[],
  ): Promise<AuthTokens> {
    const payload = { sub, email, roles: roles ?? ['user'], jti: randomUUID() };

    const accessExpSec = parseToSeconds(process.env.JWT_EXPIRES_IN, 3600); // 1h
    const refreshExpSec = parseToSeconds(
      process.env.JWT_REFRESH_EXPIRES_IN,
      1209600,
    ); // 14d

    const access_token = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: accessExpSec, // number
      audience: process.env.JWT_AUD,
      issuer: process.env.JWT_ISS,
    });

    const refresh_token = await this.jwtService.signAsync(
      { sub, jti: randomUUID() },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: refreshExpSec, // number
        audience: process.env.JWT_AUD,
        issuer: process.env.JWT_ISS,
      },
    );

    // 선택: refresh_token 해시를 DB/Redis에 저장하여 로테이션 & 블랙리스트 구현
    // await this.tokenStore.save({ userId: sub, refreshJti: parsedJti, hash: hash(refresh_token), exp: ... })

    return { access_token, refresh_token };
  }

  /** 리프레시 토큰으로 액세스 재발급 (선택) */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = await this.jwtService.verifyAsync(refreshToken, {
        audience: process.env.JWT_AUD,
        issuer: process.env.JWT_ISS,
      });
      // 저장소(예: Redis/DB)에서 refresh jti 유효성/로테이션 확인
      // await this.tokenStore.assertValid(decoded.sub, decoded.jti)

      // 필요 시 사용자 상태 확인
      const user = await this.userService.findById(decoded.sub);
      if (!user) throw new UnauthorizedException('Invalid token');

      // 로테이션: 기존 refresh 무효, 새 refresh 발급 및 저장
      return this.issueTokens(user.id, user.email, user.roles);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /** 로그아웃: stateless JWT는 서버에 “끝났다”를 알릴 저장소가 필요 */
  async logout(userId: number) {
    // 예시) 사용자 refresh 토큰 전부 무효화 / jti 블랙리스트 등록 등
    // await this.tokenStore.revokeAll(userId);
    return { userId, message: 'Logged out' };
  }
}
