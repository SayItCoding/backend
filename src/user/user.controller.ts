import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async profile(@Request() req) {
    // req.user는 JwtStrategy.validate()의 반환값
    return this.users.getProfileOrThrow(req.user.userId);
  }
}
