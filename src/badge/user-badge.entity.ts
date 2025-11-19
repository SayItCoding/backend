// src/badge/user-badge.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('user_badges')
@Unique(['userId', 'badgeId']) // 한 유저는 같은 뱃지를 두 번 못 얻음
export class UserBadge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number; // FK: users.id (실제 FK 설정은 migration에서 해도 됨)

  @Column()
  badgeId: number; // FK: badges.id

  // 이 뱃지를 언제 획득했는지
  @CreateDateColumn()
  obtainedAt: Date;

  // 나중에 "어떤 이벤트로 획득했는지" 남기고 싶으면
  @Column({ nullable: true })
  source: string; // "MISSION_COMPLETE", "STUDY_SESSION", ...
}
