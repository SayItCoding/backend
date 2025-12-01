import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UserStudySession } from '../study-session/user-study-session.entity';
import { StartStudySessionDto } from './dto/start-study-session.dto';
import { StudyDayDto, UserStudySummaryDto } from './dto/user-study-summary.dto';
import { User } from 'src/user/entity/user.entity';
import { formatDateLocal } from '../utils/formatDate';

@Injectable()
export class StudySessionsService {
  constructor(
    @InjectRepository(UserStudySession)
    private readonly sessionRepo: Repository<UserStudySession>,

    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 학습 세션 시작
   * - userId: JWT에서 가져온 현재 사용자 ID
   * - missionId: 어떤 미션에서 공부 중인지 (옵션)
   */
  async startSession(userId: number, dto: StartStudySessionDto) {
    const { missionId } = dto;

    // 아직 종료되지 않은 세션이 있는지 먼저 확인
    const qb = this.sessionRepo
      .createQueryBuilder('s')
      .where('s.userId = :userId', { userId })
      .andWhere('s.endedAt IS NULL');

    if (typeof missionId === 'number') {
      qb.andWhere('s.missionId = :missionId', { missionId });
    }

    const existing = await qb.getOne();

    if (existing) {
      // 이미 열려 있는 세션이 있으면 새로 만들지 않고 그걸 그대로 반환
      return existing;
    }

    // 없으면 새로 생성
    const session = this.sessionRepo.create({
      userId,
      missionId: missionId ?? null,
      durationSeconds: 0, // 시작 시점에는 0으로 초기화
      // startedAt은 @CreateDateColumn 이 알아서 now()로 채워줌
    });

    const saved = await this.sessionRepo.save(session);
    return saved;
  }

  /**
   * 학습 세션 종료
   * - durationSeconds를 startedAt ~ endedAt 차이로 계산해서 저장
   * - 이미 종료된 세션이면 예외
   * - 다른 유저 세션에 접근하려 하면 NotFoundException
   */
  async endSession(userId: number, sessionId: number) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('해당 학습 세션을 찾을 수 없습니다.');
    }

    if (session.endedAt) {
      throw new BadRequestException('이미 종료된 학습 세션입니다.');
    }

    const endedAt = new Date();
    session.endedAt = endedAt;

    // startedAt은 @CreateDateColumn 으로 세팅되어 있음
    const startedAt = session.startedAt;
    if (!startedAt) {
      // 이 경우는 거의 없겠지만 방어 코드
      throw new BadRequestException(
        '세션 시작 시간이 없습니다. 세션 데이터가 손상되었습니다.',
      );
    }

    const diffMs = endedAt.getTime() - startedAt.getTime();
    const seconds = Math.max(0, Math.floor(diffMs / 1000));

    session.durationSeconds = seconds;

    const saved = await this.sessionRepo.save(session);

    // streak 갱신
    await this.updateUserStreak(userId, endedAt);

    return saved;
  }

  async getUserStudySummary(
    userId: number,
    weekOffset = 0,
  ): Promise<UserStudySummaryDto> {
    // 1) 총 학습 시간(초) - 전체 누적
    const totalRow = await this.sessionRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.durationSeconds), 0)', 'total')
      .where('s.userId = :userId', { userId })
      .getRawOne<{ total: string }>();

    const totalStudySeconds = Number(totalRow?.total ?? 0);

    // 2) "이번 주 월요일" 기준 주(start/end) 계산 (로컬 기준)
    const today = new Date();
    const todayDateOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const todayDow = todayDateOnly.getDay(); // 0:일 ~ 6:토

    // 월요일 기준: 월(1)→0일 전, 화(2)→1일 전, ..., 일(0)→6일 전
    const diffFromMonday = (todayDow + 6) % 7;

    const currentWeekStart = new Date(todayDateOnly);
    currentWeekStart.setDate(currentWeekStart.getDate() - diffFromMonday);
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);

    // weekOffset 적용 (0: 이번 주, -1: 지난 주, -2: 지지난 주, ...)
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() + weekOffset * 7);

    const end = new Date(currentWeekEnd);
    end.setDate(end.getDate() + weekOffset * 7);

    // 3) 해당 주간(start~end) 동안의 세션 조회
    const sessions = await this.sessionRepo.find({
      where: {
        userId,
        startedAt: Between(start, end),
      },
    });

    // 날짜별 durationSeconds 합산 (로컬 기준 YYYY-MM-DD)
    const dayMap = new Map<string, number>();
    for (const s of sessions) {
      const d = s.startedAt;
      const key = formatDateLocal(d); // ★ 여기
      const prev = dayMap.get(key) ?? 0;
      dayMap.set(key, prev + (s.durationSeconds ?? 0));
    }

    const days: StudyDayDto[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);

      const key = formatDateLocal(d); // 로컬 기준
      const studySeconds = dayMap.get(key) ?? 0;

      days.push({
        date: key,
        label: ['월', '화', '수', '목', '금', '토', '일'][i], // 월~일 고정
        studySeconds,
      });
    }

    return {
      totalStudySeconds,
      weekly: {
        startDate: formatDateLocal(start),
        endDate: formatDateLocal(end),
        days,
      },
    };
  }

  private async updateUserStreak(userId: number, endedAt: Date) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    const today = endedAt.toISOString().slice(0, 10);
    const yesterday = new Date(endedAt);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (user.lastStudyDate === today) {
      // 오늘 이미 계산됨 변화 없음
      return;
    }

    if (user.lastStudyDate === yesterdayStr) {
      // 연속 학습 streak 증가
      user.studyStreak += 1;
    } else {
      // 연속성 끊김 다시 1
      user.studyStreak = 1;
    }

    user.lastStudyDate = today;
    await this.userRepo.save(user);
  }
}
