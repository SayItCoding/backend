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
import { MissionCode } from './entity/mission-code.entity';
import { IntentService } from 'src/ai/intentclassifier/intent.service';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class MissionService {
  constructor(
    @InjectRepository(Mission)
    private missionRepo: Repository<Mission>,
    @InjectRepository(UserMission)
    private readonly userMissionRepo: Repository<UserMission>,
    @InjectRepository(MissionChat)
    private readonly missionChatRepo: Repository<MissionChat>,
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
      select: ['id', 'context'],
    });

    return mission?.context ?? null;
  }
}
