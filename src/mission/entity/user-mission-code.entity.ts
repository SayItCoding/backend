import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_mission_codes')
export class UserMissionCode {
  @PrimaryGeneratedColumn()
  id: number;

  // 어떤 유저-미션에 대한 코드인지
  @Column()
  userMissionId: number;

  @Column()
  userId: number;

  @Column()
  missionId: number;

  // 어느 채팅 메시지 이후의 코드 상태인지 (FK 느낌)
  @Column()
  chatId: number; // MissionChat.id

  @Column({ type: 'jsonb' })
  projectData: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
