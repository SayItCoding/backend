import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { UserStudySession } from '../study-session/user-study-session.entity';
import { StartStudySessionDto } from './dto/start-study-session.dto';

@Injectable()
export class StudySessionsService {
  constructor(
    @InjectRepository(UserStudySession)
    private readonly sessionRepo: Repository<UserStudySession>,
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
    return saved;
  }
}
