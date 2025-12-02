import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { UserMission } from 'src/mission/entity/user-mission.entity';
import { MissionChat } from 'src/mission/entity/mission-chat.entity';
import { MissionChatAnalysis } from 'src/mission/entity/mission-chat-analysis.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserMission, MissionChat, MissionChatAnalysis]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
