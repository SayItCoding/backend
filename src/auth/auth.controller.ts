import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, SignupDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

import * as jsonwebtoken from 'jsonwebtoken';

@Controller('/api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() req: any) {
    return this.authService.logout(req.user.userId); // JwtStrategy.validate에서 셋팅
  }

  @Post('logout-debug')
  logoutDebug(@Req() req: any) {
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) return { error: 'No Bearer token' };
    const token = auth.slice(7);

    try {
      const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET!, {
        issuer: process.env.JWT_ISS,
        audience: process.env.JWT_AUD,
        // clockTolerance: 5, // 필요시
      });
      return { ok: true, decoded };
    } catch (e: any) {
      return { ok: false, name: e.name, message: e.message }; // e.name: JsonWebTokenError | TokenExpiredError | NotBeforeError
    }
  }
}
