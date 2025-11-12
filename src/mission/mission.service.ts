import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  paginate,
  Pagination,
  IPaginationOptions,
} from 'nestjs-typeorm-paginate';
import { Mission } from './mission.entity';
import { UserMission } from './user-mission.entity';
import { MissionChat } from './mission-chat.entity';

@Injectable()
export class MissionService {
  constructor(
    @InjectRepository(Mission)
    private missionRepo: Repository<Mission>,
    @InjectRepository(UserMission)
    private readonly userMissionRepo: Repository<UserMission>,
    @InjectRepository(MissionChat)
    private readonly missionChatRepo: Repository<MissionChat>,
  ) {}

  paginate(options: IPaginationOptions): Promise<Pagination<Mission>> {
    return paginate(this.missionRepo, options);
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
  findOne(id: number) {
    return this.missionRepo.findOneBy({ id });
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

    if (!membership) {
      membership = this.userMissionRepo.create({
        userId,
        missionId,
        isCompleted: false,
      });
      await this.userMissionRepo.save(membership);
    }

    const options: IPaginationOptions = {
      page,
      limit,
      route: `/api/v1/missions/${missionId}/chats`,
    };

    return this.paginateUserMissionChats(membership.id, options);
  }

  // 사용자 대화 입력
  async createChatAndReply(params: {
    userId: number;
    missionId: number;
    message: string;
  }) {
    const { userId, missionId, message } = params;

    // 권한 확인
    const membership = await this.userMissionRepo.findOne({
      where: { userId, missionId },
    });
    if (!membership) throw new ForbiddenException('No access to this mission');

    // TODO : user의 입력으로 ai답변을 출력하는 로직 작성
    const reply = `${message} 에 대한 테스트 답변입니다.`;

    // TODO : ai답변이 출력되었다면 user의답변과 ai답변을 db에 저장
    const userChat = this.missionChatRepo.create({
      userMissionId: membership.id,
      userId,
      missionId,
      content: message,
      role: 'user',
    });
    await this.missionChatRepo.save(userChat);

    const assistantChat = this.missionChatRepo.create({
      userMissionId: membership.id,
      userId,
      missionId,
      content: reply,
      role: 'assistant',
    });
    await this.missionChatRepo.save(assistantChat);

    return {
      missionId,
      userMissionId: membership.id,
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
    };
  }
}
