import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  async signup(payload: any) {
    // TODO: 사용자 생성 + 비밀번호 해시 + 중복 체크
    return { userId: 'new-user', message: 'Signed up' };
  }

  async login(payload: any) {
    // TODO: 사용자 검증 + 토큰 발급(JWT 등)
    return { accessToken: 'mock.jwt.token', message: 'Logged in' };
  }

  async logout(userId?: string) {
    // TODO: 토큰 블랙리스트/세션 만료 등
    return { userId, message: 'Logged out' };
  }
}
