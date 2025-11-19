import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('user_daily_status')
@Unique(['userId', 'date'])
export class UserDailyStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  // '2025-11-19' 같은 형식으로 저장 (DATE 타입)
  @Column({ type: 'date' })
  date: string;

  @Column({ default: true })
  studied: boolean; // 그 날 학습했는지 여부
}
