import { Module } from '@nestjs/common';
import { MissionController } from './mission.controller';
import { MissionService } from './mission.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mission } from './entity/mission.entity';
import { UserMission } from './entity/user-mission.entity';
import { MissionChat } from './entity/mission-chat.entity';
import { MissionCode } from './entity/mission-code.entity';
import { MissionChatAnalysis } from './entity/mission-chat-analysis.entity';

import { IntentModule } from 'src/ai/intentclassifier/intent.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Mission,
      UserMission,
      MissionChat,
      MissionCode,
      MissionChatAnalysis,
    ]),
    IntentModule,
  ],
  controllers: [MissionController],
  providers: [MissionService],
  exports: [MissionService],
})
export class MissionModule {}
