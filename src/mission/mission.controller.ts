import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  HttpCode,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MissionService } from './mission.service';
import { Pagination } from 'nestjs-typeorm-paginate';
import { Mission } from './entity/mission.entity';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('/api/v1/missions')
export class MissionController {
  constructor(private readonly missionService: MissionService) {}

  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
    @Query('category') category?: string,
  ): Promise<Pagination<Mission>> {
    limit = Math.min(limit, 100); // limit 상한

    return this.missionService.paginate(
      {
        page,
        limit,
        route: '/api/v1/missions',
      },
      { category },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':missionId')
  findOne(
    @Param('missionId', ParseIntPipe) missionId: number,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.missionService.findOne(userId, missionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':missionId/chats')
  @HttpCode(200)
  async getUserMissionChats(
    @Param('missionId', ParseIntPipe) missionId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Req() req: any,
  ) {
    return this.missionService.getUserMissionChats({
      userId: req.user.userId,
      missionId,
      page,
      limit,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':missionId/chats')
  @HttpCode(201)
  createChatAndReply(
    @Param('missionId', ParseIntPipe) missionId: number,
    @Body('content') message: string,
    @Req() req: any,
  ) {
    return this.missionService.createChatAndReply({
      userId: req.user.userId,
      missionId,
      message,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('/:missionId/mission-codes/:missionCodeId')
  async getMissionCode(
    @Param('missionId', ParseIntPipe) missionId: number,
    @Param('missionCodeId', ParseIntPipe) missionCodeId: number,
    @Req() req,
  ) {
    const userId = req.user.userId ?? req.user.id;
    return this.missionService.getMissionCodeById({
      userId,
      missionId,
      missionCodeId,
    });
  }
}
