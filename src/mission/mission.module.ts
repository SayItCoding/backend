import { Module } from '@nestjs/common';
import { MissionController } from './mission.controller';
import { MissionService } from './mission.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mission } from './entity/mission.entity';
import { UserMission } from './entity/user-mission.entity';
import { MissionChat } from './entity/mission-chat.entity';

import { IntentModule } from 'src/ai/intentclassifier/intent.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Mission, UserMission, MissionChat]),
    IntentModule,
  ],
  controllers: [MissionController],
  providers: [MissionService],
  exports: [MissionService],
})
export class MissionModule {}
