import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Badge } from './badge.entity';
import { UserBadge } from './user-badge.entity';
import { BadgeService } from './badge.service';
import { BadgeController } from './badge.controller';
import { UserMission } from 'src/mission/entity/user-mission.entity';
import { UserDailyStatus } from 'src/user/entity/user-daily-status.entity';
import { UserLearningSession } from 'src/user/entity/user-learning-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Badge,
      UserBadge,
      UserMission,
      UserDailyStatus,
      UserLearningSession,
    ]),
  ],
  providers: [BadgeService],
  controllers: [BadgeController],
  exports: [BadgeService],
})
export class BadgeModule {}
