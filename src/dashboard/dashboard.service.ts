import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  paginate,
  Pagination,
  IPaginationOptions,
} from 'nestjs-typeorm-paginate';
import { MissionChat } from '../mission/entity/mission-chat.entity';
import { UserMission } from 'src/mission/entity/user-mission.entity';
import { MissionChatAnalysis } from '../mission/entity/mission-chat-analysis.entity';
import {
  StudyInsightSummaryDto,
  IntentCount,
} from './dto/study-insight-summary.dto';
import { RecentMissionItemDto } from './dto/recent-mission.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(UserMission)
    private readonly userMissionRepo: Repository<UserMission>,
    @InjectRepository(MissionChat)
    private readonly missionChatRepo: Repository<MissionChat>,
    @InjectRepository(MissionChatAnalysis)
    private readonly missionChatAnalysisRepo: Repository<MissionChatAnalysis>,
  ) {}

  private countMap<T extends string>(values: T[]): Record<T, number> {
    const map = {} as Record<T, number>;
    for (const v of values) {
      map[v] = (map[v] ?? 0) + 1;
    }
    return map;
  }

  /**
   * 주어진 기간(from~to)에 대해 Study Insight를 계산하는 공통 함수
   * - from/to가 null이면 전체 기간
   */
  private async buildStudyInsightForRange(params: {
    userId: number;
    from: Date | null;
    to: Date | null;
  }): Promise<StudyInsightSummaryDto> {
    const { userId, from, to } = params;

    let dateCondition: any = {};
    if (from && to) {
      dateCondition = Between(from, to);
    } else if (from) {
      dateCondition = Between(from, new Date());
    } else if (to) {
      dateCondition = Between(new Date(0), to);
    } else {
      // 전체 기간: 조건 없이
      dateCondition = undefined;
    }

    const where: any = {
      role: 'user',
      userMission: { user: { id: userId } } as any,
    };
    if (dateCondition) {
      where.createdAt = dateCondition;
    }

    const chats = await this.missionChatRepo.find({
      where,
      relations: ['analysis'],
    });

    const analyses = chats
      .map((c) => c.analysis)
      .filter((a): a is MissionChatAnalysis => !!a);

    const total = analyses.length;

    // period.from/to 계산
    let periodFrom: string;
    let periodTo: string;

    if (from && to) {
      periodFrom = from.toISOString();
      periodTo = to.toISOString();
    } else if (analyses.length > 0) {
      // 전체 기간일 때는 실제 데이터 기준으로 범위 잡기
      const createdList = analyses.map((a) => a.createdAt.getTime());
      const minTime = Math.min(...createdList);
      const maxTime = Math.max(...createdList);
      periodFrom = new Date(minTime).toISOString();
      periodTo = new Date(maxTime).toISOString();
    } else {
      const now = new Date();
      periodFrom = now.toISOString();
      periodTo = now.toISOString();
    }

    const summary: StudyInsightSummaryDto = {
      period: { from: periodFrom, to: periodTo },
      totalUserMessages: total,
      globalIntentStats: [],
      taskTypeStats: [],
      questionTypeStats: [],
      loopIntentRate: 0,
      avgLoopCount: null,
      maxLoopCount: null,
      ambiguityRate: 0,
      topAmbiguityTypes: [],
      strengths: [],
      suggestions: [],
    };

    if (total === 0) {
      summary.strengths.push('분석할 대화가 아직 없습니다.');
      summary.suggestions.push('미션을 수행하면 학습 인사이트가 표시됩니다.');
      return summary;
    }

    // ▽ 아래부터는 아까 만들었던 통계/강점/추천 로직 그대로 복붙

    const countMap = this.countMap.bind(this);

    const intentValues = analyses.map((a) => a.globalIntent);
    const intentCounts = countMap(intentValues);
    summary.globalIntentStats = Object.entries(intentCounts).map(
      ([key, count]) => ({
        key,
        count: count as number,
        ratio: (count as number) / total,
      }),
    );

    const taskTypesAll = analyses.flatMap((a) => a.taskTypes ?? []);
    const taskCountMap = countMap(taskTypesAll);
    const taskTotal = taskTypesAll.length || 1;
    summary.taskTypeStats = Object.entries(taskCountMap).map(
      ([key, count]) => ({
        key,
        count: count as number,
        ratio: (count as number) / taskTotal,
      }),
    );

    const taskAnalyses = analyses.filter((a) => a.hasTaskCode);
    (summary as any).avgSlotPerTaskMessage =
      taskAnalyses.length > 0
        ? taskAnalyses.reduce((sum, a) => sum + a.slotCount, 0) /
          taskAnalyses.length
        : null;

    const questionTypesAll = analyses.flatMap((a) => a.questionTypes ?? []);
    const questionCountMap = countMap(questionTypesAll);
    const qTotal = questionTypesAll.length || 1;
    summary.questionTypeStats = Object.entries(questionCountMap).map(
      ([key, count]) => ({
        key,
        count: count as number,
        ratio: (count as number) / qTotal,
      }),
    );

    const loopAnalyses = analyses.filter((a) => a.hasLoopIntent);
    summary.loopIntentRate = loopAnalyses.length / total;

    const loopCounts = loopAnalyses
      .map((a) => a.avgLoopCount)
      .filter((n): n is number => n != null);
    if (loopCounts.length) {
      const sum = loopCounts.reduce((a, b) => a + b, 0);
      summary.avgLoopCount = Math.round(sum / loopCounts.length);
      summary.maxLoopCount = Math.max(...loopCounts);
    }

    const ambiguousAnalyses = analyses.filter((a) => a.hasAmbiguity);
    summary.ambiguityRate = ambiguousAnalyses.length / total;

    const ambiguityTypesAll = ambiguousAnalyses.flatMap(
      (a) => a.ambiguityTypes ?? [],
    );
    const ambiguityCountMap = countMap(ambiguityTypesAll);
    const ambEntries = Object.entries(ambiguityCountMap).sort(
      (a, b) => (b[1] as number) - (a[1] as number),
    );
    summary.topAmbiguityTypes = ambEntries.slice(0, 3).map(([key, count]) => ({
      key,
      count: count as number,
      ratio: (count as number) / total,
    }));

    const getRatio = (list: IntentCount[], key: string) =>
      list.find((x) => x.key === key)?.ratio ?? 0;

    if (summary.loopIntentRate > 0.2) {
      summary.strengths.push(
        '반복(루프) 구조를 자주 시도하며, 절차를 묶어서 생각하는 연습을 하고 있습니다.',
      );
    }

    if (getRatio(summary.questionTypeStats, 'WHY_WRONG') > 0.2) {
      summary.strengths.push(
        '틀린 이유를 물어보는 디버깅 질문이 많아, 원인을 이해하려는 태도가 좋습니다.',
      );
    }

    if (getRatio(summary.questionTypeStats, 'WHAT_IS_CONCEPT') > 0.1) {
      summary.strengths.push(
        '개념 자체를 묻는 질문을 통해, 단순 정답보다 이해를 중시하는 학습을 하고 있습니다.',
      );
    }

    if (summary.ambiguityRate > 0.15) {
      summary.suggestions.push(
        '“몇 번”, “어디부터 어디까지”를 더 구체적으로 말해보는 연습을 해보면 좋아요.',
      );
    }

    if (!summary.loopIntentRate || summary.loopIntentRate < 0.1) {
      summary.suggestions.push(
        '비슷한 동작이 여러 번 반복된다면, 반복(루프) 구조로 묶어보는 연습을 해보세요.',
      );
    }

    return summary;
  }

  // 주간 모드
  async getStudyInsightsByWeek(params: {
    userId: number;
    weekOffset: number;
  }): Promise<StudyInsightSummaryDto> {
    const { userId, weekOffset } = params;

    const now = new Date();
    const currentDay = now.getDay(); // 0: Sun ~ 6: Sat
    const diffToMonday = (currentDay + 6) % 7;
    const monday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - diffToMonday + weekOffset * 7,
    );
    const sunday = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + 6,
    );
    const endExclusive = new Date(sunday.getTime() + 24 * 60 * 60 * 1000);

    return this.buildStudyInsightForRange({
      userId,
      from: monday,
      to: endExclusive,
    });
  }

  // 전체 기간 모드
  async getStudyInsightsOverall(
    userId: number,
  ): Promise<StudyInsightSummaryDto> {
    return this.buildStudyInsightForRange({
      userId,
      from: null,
      to: null,
    });
  }

  // 최근 학습 미션
  async paginateRecentMissions(
    userId: number,
    options: IPaginationOptions,
  ): Promise<Pagination<RecentMissionItemDto>> {
    const qb = this.userMissionRepo
      .createQueryBuilder('um')
      .innerJoinAndSelect('um.mission', 'm')
      .where('um.userId = :userId', { userId })
      .orderBy('um.updatedAt', 'DESC')
      .addOrderBy('um.id', 'DESC');

    // UserMission 기준으로 페이지네이션
    const paged = await paginate<UserMission>(qb, options);

    // items만 DTO로 매핑하고, meta / links는 그대로 유지
    const items: RecentMissionItemDto[] = paged.items.map((um) => {
      const m = um.mission;

      const status = um.isCompleted ? '성공' : '재도전'; // 실제 필드명에 맞게 수정

      return {
        missionId: m.id,
        title: m.title,
        date: (um.updatedAt ?? new Date()).toISOString(),
        status,
        category: m.category ?? '미션', // Mission 필드에 맞게 수정
      };
    });

    return {
      ...paged,
      items,
    };
  }
}
