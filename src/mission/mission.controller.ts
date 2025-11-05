import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MissionService } from './mission.service';

@Controller('missions')
export class MissionController {
  constructor(private readonly missionService: MissionService) {}

  @Get()
  findAll() {
    return this.missionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.missionService.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.missionService.create(body);
  }
}
