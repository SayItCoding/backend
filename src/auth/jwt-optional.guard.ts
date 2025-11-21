import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtOptionalAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info) {
    // JWT가 없거나 잘못되어도 에러를 던지지 않고 user = null 로 넘어감
    return user || null;
  }
}
