export class UserProfileDto {
  id: number;
  email: string;
  name: string;
  roles?: string[] | null;
  studyStreak: number;
  lastStudyDate: string | null;
  createdAt: Date;
}
