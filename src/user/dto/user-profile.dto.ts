import { Expose } from 'class-transformer';

export class UserProfileDto {
  @Expose()
  id: number;

  @Expose()
  email: string;

  @Expose()
  name: string;

  @Expose()
  roles?: string[] | null;

  @Expose()
  studyStreak: number;

  @Expose()
  lastStudyDate: string | null;

  @Expose()
  createdAt: Date;
}
