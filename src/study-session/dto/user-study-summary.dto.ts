export class StudyDayDto {
  date: string; // 'YYYY-MM-DD'
  label: string; // '월', '화', ...
  studySeconds: number;
}

export class WeeklyStudySummaryDto {
  startDate: string;
  endDate: string;
  days: StudyDayDto[];
}

export class UserStudySummaryDto {
  totalStudySeconds: number;
  weekly: WeeklyStudySummaryDto;
}
