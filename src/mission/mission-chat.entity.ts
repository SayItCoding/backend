import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('mission_chats')
export class MissionChat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userMissionId: number;

  @Column()
  userId: number;

  @Column()
  missionId: number;

  @Column()
  content: string; // 메시지

  @Column()
  role: 'user' | 'assistant'; // 누가 보낸 메시지인지

  @CreateDateColumn()
  createdAt: Date;
}
