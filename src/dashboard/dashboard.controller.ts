import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { StudyInsightSummaryDto } from './dto/study-insight-summary.dto';
import { Pagination } from 'nestjs-typeorm-paginate';
import { RecentMissionItemDto } from './dto/recent-mission.dto';

@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard)
  @Get('study-insights')
  async getStudyInsights(
    @Req() req,
    @Query('mode') mode = 'overall',
    @Query('weekOffset') weekOffset = '0',
  ): Promise<StudyInsightSummaryDto> {
    if (mode === 'week') {
      return this.dashboardService.getStudyInsightsByWeek({
        userId: req.user.userId,
        weekOffset: Number(weekOffset),
      });
    }

    // 기본은 전체 기간 모드
    return this.dashboardService.getStudyInsightsOverall(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('recent-missions')
  async getRecentMissions(
    @Req() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(6), ParseIntPipe) limit: number,
  ): Promise<Pagination<RecentMissionItemDto>> {
    const userId = req.user?.userId ?? null;

    return this.dashboardService.paginateRecentMissions(userId, {
      page,
      limit,
      route: '/api/v1/dashboard/recent-missions',
    });
  }
}
