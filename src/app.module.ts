import { Module } from '@nestjs/common';
import { AssignmentModule } from './assignment/assignment.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { MissionModule } from './mission/mission.module';
import { AppController } from './app.controller';

@Module({
  imports: [MissionModule, AssignmentModule, DashboardModule, AuthModule],
  controllers: [AppController],
})
export class AppModule {}
