// src/ai/intentclassifier/intent.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { IntentController } from './intent.controller';
import { IntentService } from './intent.service';
import { OpenAIClient } from '../openai/openai.client';
import { IntentLog } from './intent-log.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionModule } from 'src/mission/mission.module';
import { MissionCode } from 'src/mission/entity/mission-code.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MissionCode, IntentLog]),
    forwardRef(() => MissionModule),
  ],
  controllers: [IntentController],
  providers: [IntentService, OpenAIClient],
  exports: [IntentService],
})
export class IntentModule {}
