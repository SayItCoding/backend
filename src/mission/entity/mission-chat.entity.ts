import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { UserMission } from './user-mission.entity';
import { MissionChatAnalysis } from './mission-chat-analysis.entity';

@Entity('mission_chats')
export class MissionChat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  missionCodeId: number;

  @Column()
  content: string; // 메시지

  @Column()
  role: 'user' | 'assistant'; // 누가 보낸 메시지인지

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => UserMission, (userMission) => userMission.missionChats, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userMissionId' })
  userMission: UserMission;

  @OneToOne(() => MissionChatAnalysis, (analysis) => analysis.chat)
  analysis?: MissionChatAnalysis;
}
