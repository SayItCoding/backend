// src/ai/intentclassifier/intent.controller.ts
import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { IntentService } from './intent.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('intent')
export class IntentController {
  constructor(private readonly intentService: IntentService) {}

  @Get()
  test() {
    return 'intent classifier';
  }

  @UseGuards(JwtAuthGuard)
  @Post('/process')
  async process(@Body() body, @Req() req) {
    const { utterance, projectData, map, char_location, direction } = body;
    const userId = req.user.userId ?? req.user.id;
    return this.intentService.process(
      userId,
      utterance,
      projectData,
      map,
      char_location,
      direction,
    );
  }
}
