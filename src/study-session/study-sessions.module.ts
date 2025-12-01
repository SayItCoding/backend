// src/study-session/study-sessions.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserStudySession } from '../study-session/user-study-session.entity';
import { StudySessionsService } from './study-sessions.service';
import { StudySessionsController } from './study-sessions.controller';
import { User } from 'src/user/entity/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserStudySession, User])],
  providers: [StudySessionsService],
  controllers: [StudySessionsController],
  exports: [StudySessionsService],
})
export class StudySessionsModule {}
