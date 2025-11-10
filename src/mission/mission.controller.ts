import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { MissionService } from './mission.service';
import { Pagination } from 'nestjs-typeorm-paginate';
import { Mission } from './mission.entity';

@Controller('/api/v1/missions')
export class MissionController {
  constructor(private readonly missionService: MissionService) {}

  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ): Promise<Pagination<Mission>> {
    // limit 상한
    limit = Math.min(limit, 100);

    return this.missionService.paginate({
      page,
      limit,
      route: '/api/v1/missions',
    });
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.missionService.findOne(id);
  }
}
