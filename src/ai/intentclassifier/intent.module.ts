// src/ai/intentclassifier/intent.module.ts
import { Module } from '@nestjs/common';
import { IntentController } from './intent.controller';
import { IntentService } from './intent.service';
import { OpenAIClient } from '../openai/openai.client';
import { IntentLog } from './intent-log.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([IntentLog])],
  controllers: [IntentController],
  providers: [IntentService, OpenAIClient],
  exports: [IntentService],
})
export class IntentModule {}
