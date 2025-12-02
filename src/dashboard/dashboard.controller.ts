import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { StudyInsightSummaryDto } from './dto/study-insight-summary.dto';

@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('study-insights')
  @UseGuards(JwtAuthGuard)
  async getStudyInsights(
    @Req() req,
    @Query('mode') mode = 'week',
    @Query('weekOffset') weekOffset = '0',
  ): Promise<StudyInsightSummaryDto> {
    const userId = req.user.id;

    if (mode === 'overall') {
      return this.dashboardService.getStudyInsightsOverall(userId);
    }

    // 기본은 week 모드
    return this.dashboardService.getStudyInsightsByWeek({
      userId,
      weekOffset: Number(weekOffset),
    });
  }
}
