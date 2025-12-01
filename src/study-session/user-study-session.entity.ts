import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { User } from '../user/entity/user.entity';
import { Mission } from '../mission/entity/mission.entity';

@Entity('user_study_sessions')
@Index('user_active_study_session_unique', ['userId', 'missionId'], {
  unique: true,
  where: '"endedAt" IS NULL',
})
export class UserStudySession {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (u) => u.userStudySessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => Mission, (m) => m.studySessions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'missionId' })
  mission: Mission | null;

  @Column({ type: 'int', nullable: true })
  missionId: number | null;

  // 이 세션에서 학습한 시간(초)
  @Column()
  durationSeconds: number;

  // 세션이 시작된 시각 (프론트/백에서 넣는 방식은 설계에 따라)
  @CreateDateColumn()
  startedAt: Date;

  // 원하면 종료 시각도 추가 가능
  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;
}
