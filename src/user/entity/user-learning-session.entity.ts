import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('user_learning_sessions')
export class UserLearningSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  // 이 세션에서 학습한 시간(분)
  @Column()
  durationMinutes: number;

  // 세션이 시작된 시각 (프론트/백에서 넣는 방식은 설계에 따라)
  @CreateDateColumn()
  startedAt: Date;

  // 원하면 종료 시각도 추가 가능
  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;
}
