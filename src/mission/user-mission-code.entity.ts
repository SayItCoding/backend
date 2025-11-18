import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
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

  // 전체 프로젝트 JSON (Entry project.json 통째로 저장)
  @Column({ type: 'jsonb' }) // postgres면 jsonb 추천, 아니면 'text'
  projectData: any;

  // scripts 부분만 따로 쓰고 싶으면 (선택)
  @Column({ type: 'jsonb', nullable: true })
  scripts: any;

  @CreateDateColumn()
  createdAt: Date;
}
