import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Badge } from './badge.entity';
import { UserBadge } from './user-badge.entity';
import { BadgeConditionType } from './badge-condition-type.enum';
import { UserMission } from '../mission/entity/user-mission.entity';
import { UserDailyStatus } from 'src/user/entity/user-daily-status.entity';
import { UserStudySession } from 'src/study-session/user-study-session.entity';

@Injectable()
export class BadgeService {
  constructor(
    @InjectRepository(Badge)
    private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(UserBadge)
    private readonly userBadgeRepo: Repository<UserBadge>,
    @InjectRepository(UserMission)
    private readonly userMissionRepo: Repository<UserMission>,
    @InjectRepository(UserStudySession)
    private readonly learningSessionRepo: Repository<UserStudySession>,
    @InjectRepository(UserDailyStatus)
    private readonly dailyStatusRepo: Repository<UserDailyStatus>,
  ) {}

  // 1) 미션 완료 시 호출
  async checkBadgesOnMissionComplete(userId: number): Promise<void> {
    const badges = await this.badgeRepo.find({
      where: {
        conditionType: BadgeConditionType.MISSION_COMPLETE_COUNT,
        isActive: true,
      },
    });
    await this.evaluateAndAward(userId, badges);
  }

  // 2) 학습 시간 업데이트 시 호출
  async checkBadgesOnStudyUpdated(userId: number): Promise<void> {
    const badges = await this.badgeRepo.find({
      where: {
        conditionType: BadgeConditionType.LEARNING_TIME_TOTAL,
        isActive: true,
      },
    });
    await this.evaluateAndAward(userId, badges);
  }

  // 3) 매일 로그인/학습 시 호출 -> 연속 출석
  async checkBadgesOnDailyActivity(userId: number): Promise<void> {
    const badges = await this.badgeRepo.find({
      where: {
        conditionType: BadgeConditionType.STUDY_STREAK_DAYS,
        isActive: true,
      },
    });
    await this.evaluateAndAward(userId, badges);
  }

  // ---------- 공통 평가 로직 ----------

  private async evaluateAndAward(
    userId: number,
    badges: Badge[],
  ): Promise<void> {
    if (!badges.length) return;

    // 이미 획득한 뱃지 제외
    const owned = await this.userBadgeRepo.find({
      where: { userId },
    });
    const ownedIds = new Set(owned.map((ub) => ub.badgeId));

    for (const badge of badges) {
      if (ownedIds.has(badge.id)) continue;

      const ok = await this.checkCondition(userId, badge);
      if (!ok) continue;

      await this.userBadgeRepo.save(
        this.userBadgeRepo.create({
          userId,
          badgeId: badge.id,
          source: 'AUTO',
        }),
      );
    }
  }

  private async checkCondition(userId: number, badge: Badge): Promise<boolean> {
    switch (badge.conditionType) {
      case BadgeConditionType.MISSION_COMPLETE_COUNT:
        return this.checkMissionCount(userId, badge.threshold);

      case BadgeConditionType.LEARNING_TIME_TOTAL:
        return this.checkLearningTime(userId, badge.threshold);

      case BadgeConditionType.STUDY_STREAK_DAYS:
        return this.checkStudyStreak(userId, badge.threshold);

      default:
        return false;
    }
  }

  // ---------- 개별 조건 구현 ----------

  private async checkMissionCount(
    userId: number,
    threshold: number,
  ): Promise<boolean> {
    const count = await this.userMissionRepo.count({
      where: { userId, isCompleted: 'true' as any },
    });
    return count >= threshold;
  }

  private async checkLearningTime(
    userId: number,
    thresholdMinutes: number,
  ): Promise<boolean> {
    const raw = (await this.learningSessionRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.durationMinutes), 0)', 'sum')
      .where('s.userId = :userId', { userId })
      .getRawOne<{ sum: string }>()) ?? { sum: '0' };

    const total = parseInt(raw.sum, 10);
    return total >= thresholdMinutes;
  }

  private async checkStudyStreak(
    userId: number,
    requiredDays: number,
  ): Promise<boolean> {
    // 최근 N일 내역을 날짜 역순으로 가져와서 연속일수 계산
    const activities = await this.dailyStatusRepo
      .createQueryBuilder('a')
      .where('a.userId = :userId', { userId })
      .andWhere('a.studied = true')
      .orderBy('a.date', 'DESC')
      .limit(requiredDays * 2) // 여유 있게
      .getMany();

    if (!activities.length) return false;

    // streak 계산 (PostgreSQL date string 기준)
    let streak = 1;
    for (let i = 1; i < activities.length; i++) {
      const prev = new Date(activities[i - 1].date);
      const curr = new Date(activities[i].date);
      const diffDays = (Number(prev) - Number(curr)) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        streak++;
        if (streak >= requiredDays) return true;
      } else if (diffDays > 1) {
        break;
      }
    }

    return streak >= requiredDays;
  }

  // ---------- 조회용 ----------

  async getUserBadges(userId: number) {
    return this.userBadgeRepo.find({
      where: { userId },
      relations: ['badge'], // 필요하면 relation 설정
    });
  }
}
