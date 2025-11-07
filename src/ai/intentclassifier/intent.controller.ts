// src/ai/intentclassifier/intent.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { IntentService } from './intent.service';

@Controller('intent')
export class IntentController {
  constructor(private readonly intentService: IntentService) {}

  @Get()
  test() {
    return 'intent classifier';
  }

  @Post('classify')
  async classify(
    @Body()
    body: {
      utterance: string;
      map?: string;
      char_location?: string;
      direction?: string;
    },
  ) {
    const result = await this.intentService.classify(
      body.utterance,
      body.map ?? 'unknown',
      body.char_location ?? '0,0',
      body.direction ?? 'north',
    );
    return result;
  }
}
