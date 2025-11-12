import { Module } from '@nestjs/common';
import { MissionController } from './mission.controller';
import { MissionService } from './mission.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mission } from './mission.entity';
import { UserMission } from './user-mission.entity';
import { MissionChat } from './mission-chat.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Mission, UserMission, MissionChat])],
  controllers: [MissionController],
  providers: [MissionService],
  exports: [MissionService],
})
export class MissionModule {}
