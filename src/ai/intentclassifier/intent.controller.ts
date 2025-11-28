// src/ai/intentclassifier/intent.controller.ts
import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { IntentService } from './intent.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('intent')
export class IntentController {
  constructor(private readonly intentService: IntentService) {}

  @Get('/classify')
  classifyTest(@Body('content') utterance: string) {
    return this.intentService.classify(utterance);
  }

  @Get('/conversation')
  conversationTest() {
    return;
  }

  @Get()
  processTest(@Body('content') utterance: string) {
    return;
  }
}
