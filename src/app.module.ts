import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssignmentModule } from './assignment/assignment.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { MissionModule } from './mission/mission.module';
import { AppController } from './app.controller';
import { IntentModule } from './ai/intentclassifier/intent.module';

@Module({
  imports: [
    MissionModule,
    AssignmentModule,
    DashboardModule,
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true, // 모든 모듈에서 process.env 사용 가능
    }),
    IntentModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
