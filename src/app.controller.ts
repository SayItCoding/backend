import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return { ok: true, message: 'Nest is running' };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
