import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  paginate,
  Pagination,
  IPaginationOptions,
} from 'nestjs-typeorm-paginate';
import { Mission } from './entity/mission.entity';
import { UserMission } from './entity/user-mission.entity';
import { MissionChat } from './entity/mission-chat.entity';
import { MissionChatAnalysis } from './entity/mission-chat-analysis.entity';
import { MissionCode } from './entity/mission-code.entity';
import { IntentService } from 'src/ai/intentclassifier/intent.service';
import {
  IntentItemT,
  TaskType,
  QuestionType,
  AmbiguityType,
} from 'src/ai/intentclassifier/intent.schema';
import { NotFoundException } from '@nestjs/common';
import {
  judgeMissionFromEntryScript,
  MissionDefinition,
  MissionJudgeResult,
  extractActionsFromEntryScript,
  CellType,
} from '../utils/entry/mission-judge';
import { EntryBlock } from '../utils/entry/blockTypes';
import { Direction } from '../utils/entry/mission-judge';
import { normalizeScripts } from '../utils/entry/scriptBuilder';

@Injectable()
export class MissionService {
  constructor(
    @InjectRepository(Mission)
    private missionRepo: Repository<Mission>,
    @InjectRepository(UserMission)
    private readonly userMissionRepo: Repository<UserMission>,
    @InjectRepository(MissionChat)
    private readonly missionChatRepo: Repository<MissionChat>,
    @InjectRepository(MissionChatAnalysis)
    private readonly missionChatAnalysisRepo: Repository<MissionChatAnalysis>,
    @InjectRepository(MissionCode)
    private readonly missionCodeRepo: Repository<MissionCode>,
    private readonly intentService: IntentService,
  ) {}

  /** 미션의 기본 projectData(JSON)를 반환 */
  async getDefaultProjectData(missionId: number): Promise<any> {
    const mission = await this.missionRepo.findOne({
      where: { id: missionId },
    });

    if (!mission) {
      throw new Error(`Mission ${missionId} not found`);
    }

    let json = mission.projectData;

    // 문자열이면 파싱
    if (typeof json === 'string') {
      try {
        json = JSON.parse(json);
      } catch (e) {
        console.error('기본 projectData 파싱 실패:', e);
      }
    }

    return json;
  }

  private buildEmptyPagination<T>(options: IPaginationOptions): Pagination<T> {
    const limit =
      typeof options.limit === 'string'
        ? parseInt(options.limit, 10)
        : options.limit;

    const page =
      typeof options.page === 'string'
        ? parseInt(options.page, 10)
        : options.page;

    return {
      items: [],
      meta: {
        itemCount: 0,
        totalItems: 0,
        itemsPerPage: limit,
        totalPages: 0,
        currentPage: page,
      },
      links: {
        first: '',
        previous: '',
        next: '',
        last: '',
      },
    };
  }

  async paginate(
    options: IPaginationOptions,
    filter?: { category?: string },
  ): Promise<Pagination<Mission>> {
    const where: any = {};

    if (filter?.category) {
      where.category = filter.category;
    }

    return paginate<Mission>(this.missionRepo, options, {
      where,
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        category: true,
        difficulty: true,
        createdAt: true,
        updatedAt: true,
        //projectData 생략
      },
    });
  }

  async paginateQB(options: IPaginationOptions): Promise<Pagination<Mission>> {
    const qb = this.missionRepo.createQueryBuilder('u');
    qb.orderBy('u.createdAt', 'DESC');
    return paginate(qb, options);
  }

  async paginateUserMissionChats(
    userMissionId: number,
    options: IPaginationOptions,
  ): Promise<Pagination<MissionChat>> {
    const qb = this.missionChatRepo
      .createQueryBuilder('chat')
      .where('chat.userMissionId = :userMissionId', { userMissionId })
      .orderBy('chat.createdAt', 'DESC')
      .addOrderBy('chat.id', 'DESC');

    return paginate<MissionChat>(qb, options);
  }

  // 모든 미션 목록 반환
  findAll() {
    return this.missionRepo.find();
  }

  // id로 미션 조회
  async findOne(userId: number, missionId: number) {
    // 기본 mission 데이터
    const mission = await this.missionRepo.findOne({
      where: { id: missionId },
    });

    if (!mission) {
      throw new NotFoundException('Mission not found');
    }

    // userId가 안 넘어오면 기본값 그대로 반환
    if (!userId) {
      return mission;
    }

    // userMission이 있는지 확인
    const userMission = await this.userMissionRepo.findOne({
      where: { userId, missionId },
    });

    // userMission 자체가 없으면 기본 mission 반환
    if (!userMission) {
      return mission;
    }

    // latestMissionCodeId가 있으면 해당 코드 사용
    if (userMission.latestMissionCodeId) {
      const snapshot = await this.missionCodeRepo.findOne({
        where: { id: userMission.latestMissionCodeId },
      });

      if (snapshot && snapshot.projectData) {
        return {
          ...mission,
          projectData: snapshot.projectData,
        };
      }
    }

    // 없으면 원래 mission 데이터 반환
    return mission;
  }

  // 사용자 미션별 대화 내역 조회
  async getUserMissionChats(params: {
    userId: number;
    missionId: number;
    page: number;
    limit: number;
  }) {
    const { userId, missionId, page, limit } = params;

    let membership = await this.userMissionRepo.findOne({
      where: { userId, missionId },
    });

    const options: IPaginationOptions = {
      page,
      limit,
      route: `/api/v1/missions/${missionId}/chats`,
    };

    if (!membership) {
      return this.buildEmptyPagination<MissionChat>(options);
    }

    return this.paginateUserMissionChats(membership.id, options);
  }

  // 사용자 대화 입력
  async createChatAndReply(params: {
    userId: number;
    missionId: number;
    message: string;
    missionCodeId: number | null;
  }) {
    const { userId, missionId, message, missionCodeId } = params;

    // 권한 확인
    let membership = await this.userMissionRepo.findOne({
      where: { userId, missionId },
    });
    if (!membership) {
      membership = this.userMissionRepo.create({
        userId,
        missionId,
      });
      membership = await this.userMissionRepo.save(membership);
    }

    // 어떤 코드를 기준으로 수정할 지 결정
    const baseCodeId = missionCodeId ?? membership.latestMissionCodeId ?? null;

    const AIResult = await this.intentService.process({
      missionId,
      latestMissionCodeId: baseCodeId,
      utterance: message,
    });

    const assistantMessage = AIResult.message;
    const updatedProjectData = AIResult.projectData; // 변경된 코드 | null
    const didChangeCode = AIResult.didChangeCode ?? false;
    const intentItem = AIResult.intent;

    if (didChangeCode) {
      const newMissionCode = this.missionCodeRepo.create({
        userMission: membership,
        projectData: updatedProjectData,
      });
      await this.missionCodeRepo.save(newMissionCode);

      // user_missions.latestMissionCodeId 갱신
      membership.latestMissionCodeId = newMissionCode.id;
      await this.userMissionRepo.save(membership);
    }

    // user 메시지 저장
    const userChat = this.missionChatRepo.create({
      userMission: membership,
      missionCodeId: membership.latestMissionCodeId,
      content: message,
      role: 'user',
    });
    await this.missionChatRepo.save(userChat);

    // Intent 분석 결과 저장 (Study Insight용)
    try {
      await this.saveMissionChatAnalysis(userChat, intentItem);
    } catch (e) {
      console.error('❌ MissionChatAnalysis 저장 실패:', e);
      // 인사이트는 부가 기능이므로 여기서 실패해도 흐름은 계속 진행
    }

    // assistant 메시지 저장
    const assistantChat = this.missionChatRepo.create({
      userMission: membership,
      missionCodeId: membership.latestMissionCodeId,
      content: assistantMessage,
      role: 'assistant',
    });
    await this.missionChatRepo.save(assistantChat);

    return {
      missionId,
      userMissionId: membership.id,
      missionCodeId: membership.latestMissionCodeId, // 이 대화까지의 코드 스냅샷 ID
      items: [
        {
          id: userChat.id,
          role: userChat.role,
          content: userChat.content,
          createdAt: userChat.createdAt,
        },
        {
          id: assistantChat.id,
          role: assistantChat.role,
          content: assistantChat.content,
          createdAt: assistantChat.createdAt,
        },
      ],
      projectData: updatedProjectData,
    };
  }

  async getMissionCodeById(params: {
    userId: number;
    missionId: number;
    missionCodeId: number;
  }) {
    const { userId, missionId, missionCodeId } = params;

    // userMission 존재 확인
    const membership = await this.userMissionRepo.findOne({
      where: { userId, missionId },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this mission');
    }

    // missionCode가 해당 userMission의 것인지 확인
    const missionCode = await this.missionCodeRepo.findOne({
      where: {
        id: missionCodeId,
        userMission: { id: membership.id },
      },
    });

    if (!missionCode) {
      throw new NotFoundException(
        `Mission code ${missionCodeId} not found for this mission`,
      );
    }

    return {
      missionId,
      missionCodeId,
      projectData: missionCode.projectData,
      createdAt: missionCode.createdAt,
    };
  }

  async getMissionContext(missionId: number): Promise<any | null> {
    const mission = await this.missionRepo.findOne({
      where: { id: missionId },
      select: ['id', 'category', 'context'],
    });

    if (!mission) return null;

    return {
      category: mission.category,
      context: mission.context,
    };
  }

  // IntentItem → MissionChatAnalysis 엔티티로 변환 + 저장하는 헬퍼
  private async saveMissionChatAnalysis(
    chat: MissionChat,
    intent: IntentItemT,
  ) {
    const slots = intent.slots ?? [];

    const taskTypeSet = new Set<TaskType>();
    const questionTypeSet = new Set<QuestionType>();
    const ambiguityTypeSet = new Set<AmbiguityType>();

    let hasLoopIntent = false;
    const loopCounts: number[] = [];
    let hasAmbiguity = false;

    for (const s of slots) {
      if (s.taskType) taskTypeSet.add(s.taskType);
      if (s.questionType) questionTypeSet.add(s.questionType);

      if (s.loopExplicit || s.loopCount != null) {
        hasLoopIntent = true;
      }
      if (typeof s.loopCount === 'number') {
        loopCounts.push(s.loopCount);
      }

      if (s.needsClarification) {
        hasAmbiguity = true;
      }
      if (s.ambiguityType) {
        ambiguityTypeSet.add(s.ambiguityType);
      }
    }

    let avgLoopCount: number | null = null;
    let maxLoopCount: number | null = null;
    if (loopCounts.length > 0) {
      const sum = loopCounts.reduce((a, b) => a + b, 0);
      avgLoopCount = Math.round(sum / loopCounts.length);
      maxLoopCount = Math.max(...loopCounts);
    }

    const analysis = this.missionChatAnalysisRepo.create({
      chat,
      chatId: chat.id,
      globalIntent: intent.globalIntent,
      confidence: intent.confidence ?? 0.8,
      slots,
      slotCount: slots.length,
      hasTaskCode: taskTypeSet.size > 0,
      hasQuestion: questionTypeSet.size > 0,
      taskTypes: taskTypeSet.size ? Array.from(taskTypeSet) : null,
      questionTypes: questionTypeSet.size ? Array.from(questionTypeSet) : null,
      hasLoopIntent,
      avgLoopCount,
      maxLoopCount,
      hasAmbiguity,
      ambiguityTypes: ambiguityTypeSet.size
        ? Array.from(ambiguityTypeSet)
        : null,
      rawIntent: intent,
    });

    await this.missionChatAnalysisRepo.save(analysis);
  }

  /**
   * 같은 동작 블록이 연속해서 2개 이상 등장하는지 검사하는 헬퍼
   * - 검사 대상: move_forward, rotate_direction_left, rotate_direction_right
   * - repeat_basic 안/밖 모두 재귀적으로 훑음
   */
  private hasConsecutiveSameActionBlocks(script: EntryBlock[]): boolean {
    const SIMPLE_TYPES = new Set([
      'move_forward',
      'rotate_direction_left',
      'rotate_direction_right',
    ]);

    const dfs = (blocks: EntryBlock[]): boolean => {
      let lastType: string | null = null;
      let runLength = 0;

      for (const b of blocks) {
        const isSimple = SIMPLE_TYPES.has(b.type);
        const currentType = isSimple ? b.type : null;

        if (currentType) {
          if (currentType === lastType) {
            runLength += 1;
            // runLength: 1 → 첫 블록, 2 이상 → 연속
            if (runLength >= 2) {
              return true; // 같은 동작이 연달아 나옴
            }
          } else {
            lastType = currentType;
            runLength = 1;
          }
        } else {
          // 단순 동작이 아니면 연속 카운트 리셋
          lastType = null;
          runLength = 0;
        }

        // 자식 statements 도 재귀적으로 검사
        if (Array.isArray(b.statements)) {
          for (const slot of b.statements) {
            if (Array.isArray(slot) && slot.length > 0) {
              if (dfs(slot)) return true;
            }
          }
        }
      }
      return false;
    };

    return dfs(script);
  }

  private toMissionDefinitionOrNull(
    mission: Mission,
  ): MissionDefinition | null {
    const ctx: any = mission.context;
    if (!ctx) {
      console.error(`Mission ${mission.id} has no context`);
      return null;
    }

    const mapArr = ctx.map;
    const start = ctx.START;
    const end = ctx.END;
    const initialDir = ctx.initialDirection; // key 이름: initialDirection

    // 기본 구조 검증
    if (!Array.isArray(mapArr)) {
      console.error(`Mission ${mission.id} has invalid context.map`, mapArr);
      return null;
    }

    if (!start || typeof start.x !== 'number' || typeof start.y !== 'number') {
      console.error(`Mission ${mission.id} has invalid START`, start);
      return null;
    }

    if (!end || typeof end.x !== 'number' || typeof end.y !== 'number') {
      console.error(`Mission ${mission.id} has invalid END`, end);
      return null;
    }

    // 1) 맵 변환: string[][] → CellType[][]
    const grid: CellType[][] = mapArr.map((row: string[]) =>
      row.map((cell) => {
        switch (cell) {
          case 'VOID':
            // 이동 불가능
            return 'WALL';
          case 'END':
            // 도착 지점
            return 'GOAL';
          case 'START':
          case 'EMPTY':
            // START도 실제로는 지나갈 수 있는 칸이라 EMPTY 취급
            return 'EMPTY';
          default:
            return 'EMPTY';
        }
      }),
    );

    if (!grid.length || !grid[0]?.length) {
      console.error(`Mission ${mission.id} has empty grid`, grid);
      return null;
    }

    // 2) 방향 변환
    const directionMap: Record<string, Direction> = {
      '+x': 'SOUTH',
      '-x': 'NORTH',
      '+y': 'EAST',
      '-y': 'WEST',
    };

    const startDir: Direction = directionMap[initialDir] ?? 'EAST';

    // 좌표계 주의:
    // x = row index, y = col index (map[x][y])
    return {
      id: mission.id,
      map: {
        width: grid[0].length,
        height: grid.length,
        grid,
      },
      start: {
        row: start.x,
        col: start.y,
        dir: startDir,
      },
      end: {
        row: end.x,
        col: end.y,
      },
      maxSteps: undefined,
    };
  }

  async checkMissionSuccess(params: {
    userId: number;
    missionId: number;
    missionCodeId?: number;
  }) {
    const { userId, missionId, missionCodeId } = params;

    // 1) 미션 조회
    const mission = await this.missionRepo.findOne({
      where: { id: missionId },
    });
    if (!mission) {
      throw new NotFoundException('Mission not found');
    }

    // 2) userMission 확인
    const membership = await this.userMissionRepo.findOne({
      where: { userId, missionId },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this mission');
    }

    // 3) 검사할 MissionCode 결정
    let codeToCheck: MissionCode | null = null;

    // missionCodeId 있을 때: 0도 허용해야 하므로 != null 로 체크
    if (missionCodeId != null) {
      codeToCheck = await this.missionCodeRepo.findOne({
        where: {
          id: missionCodeId,
          userMission: { id: membership.id },
        },
      });
      if (!codeToCheck) {
        throw new NotFoundException(`MissionCode ${missionCodeId} not found`);
      }
    } else if (membership.latestMissionCodeId) {
      codeToCheck = await this.missionCodeRepo.findOne({
        where: {
          id: membership.latestMissionCodeId,
          userMission: { id: membership.id },
        },
      });
    }

    // 코드 스냅샷이 없으면 "판정 불가 → 실패" 로 돌려주자 (500 내지 말고)
    if (!codeToCheck?.projectData) {
      return {
        missionId,
        missionCodeId: null,
        isSuccess: false,
        failReason: 'NOT_AT_GOAL' as const,
        finalState: null,
      };
    }

    // 4) 나머지는 시뮬레이션 에러가 나도 절대 throw하지 않도록 try/catch
    try {
      // projectData → EntryBlock[]
      let projectData = codeToCheck.projectData as any;
      if (typeof projectData === 'string') {
        projectData = JSON.parse(projectData);
      }

      const { scripts } = normalizeScripts(projectData);
      const mainScript: EntryBlock[] = scripts[0] ?? [];

      // 5) MissionDefinition 변환
      const missionDef = this.toMissionDefinitionOrNull(mission);
      if (!missionDef) {
        // context가 잘못된 미션이면 역시 "실패"로 응답만 한다
        return {
          missionId,
          missionCodeId: codeToCheck.id,
          isSuccess: false,
          failReason: 'NOT_AT_GOAL' as const,
          finalState: null,
        };
      }

      // 6) 시뮬레이션
      const judge = judgeMissionFromEntryScript(missionDef, mainScript);

      // 7) 스타일(반복문 사용) 진단
      const hasConsecutive = this.hasConsecutiveSameActionBlocks(mainScript);
      const isStyleValid = !hasConsecutive;

      // 최종 성공 기준: 오직 도달 여부만
      const isSuccess = judge.isSuccess;

      // 8) 미션 성공 시 user_missions 업데이트
      if (isSuccess) {
        try {
          // 이미 완료한 미션이면 completedAt은 유지
          if (!membership.isCompleted) {
            membership.isCompleted = true;
            membership.completedAt = new Date();

            // 옵션: 성공 시점의 코드 스냅샷을 latest로 고정하고 싶으면 유지
            membership.latestMissionCodeId = codeToCheck.id;

            await this.userMissionRepo.save(membership);
          }
        } catch (e) {
          // 여기서 에러가 나더라도 판정 결과는 그대로 반환 (UX 우선)
          console.error(
            'checkMissionSuccess: user_missions 업데이트 중 오류:',
            e,
          );
        }
      }

      return {
        missionId,
        missionCodeId: codeToCheck.id,
        isSuccess,
        failReason: judge.isSuccess ? undefined : judge.failReason,
        finalState: judge.finalState,

        style: {
          hasConsecutiveSameActions: hasConsecutive, // true면 “반복문 추천”
          isStyleValid, // false면 스타일 코칭 대상
        },
      };
    } catch (e) {
      console.error('checkMissionSuccess judge error:', e);

      // 어떤 에러든 500 대신 "실패" 응답
      return {
        missionId,
        missionCodeId: codeToCheck.id,
        isSuccess: false,
        failReason: 'NOT_AT_GOAL' as const,
        finalState: null,
      };
    }
  }
}
