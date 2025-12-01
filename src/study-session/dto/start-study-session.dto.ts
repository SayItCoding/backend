import { IsInt, IsOptional } from 'class-validator';

export class StartStudySessionDto {
  @IsOptional()
  @IsInt()
  missionId?: number;
}
