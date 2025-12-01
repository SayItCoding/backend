import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  Req,
  Get,
  Query,
  DefaultValuePipe,
} from '@nestjs/common';
import { StudySessionsService } from './study-sessions.service';
import { StartStudySessionDto } from './dto/start-study-session.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/study-sessions')
@UseGuards(JwtAuthGuard)
export class StudySessionsController {
  constructor(private readonly studySessionsService: StudySessionsService) {}

  /**
   * POST /api/v1/study-sessions
   * 학습 세션 시작 API
   */
  @Post()
  async startStudySession(@Req() req: any, @Body() dto: StartStudySessionDto) {
    const userId = req.user.userId ?? req.user.id;
    const session = await this.studySessionsService.startSession(userId, dto);
    return {
      id: session.id, // sessionId
      userId: session.userId,
      missionId: session.missionId,
      durationSeconds: session.durationSeconds,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    };
  }

  /**
   * PATCH /api/v1/study-sessions/:sessionId/end
   * 학습 세션 종료 API
   */
  @Patch(':sessionId/end')
  async endStudySession(
    @Req() req: any,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    const userId = req.user.userId ?? req.user.id;
    const session = await this.studySessionsService.endSession(
      userId,
      sessionId,
    );
    return {
      id: session.id,
      userId: session.userId,
      missionId: session.missionId,
      durationSeconds: session.durationSeconds,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    };
  }

  @Get('summary')
  async getMyStudySummary(
    @Req() req: any,
    @Query('weekOffset', new DefaultValuePipe(0), ParseIntPipe)
    weekOffset: number,
  ) {
    const userId = req.user.userId ?? req.user.id;
    return this.studySessionsService.getUserStudySummary(userId, weekOffset);
  }
}
