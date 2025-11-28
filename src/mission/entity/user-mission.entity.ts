import {
  Entity,
  Unique,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Mission } from './mission.entity';
import { User } from '../../user/entity/user.entity';
import { MissionChat } from './mission-chat.entity';
import { MissionCode } from './mission-code.entity';

@Entity('user_missions')
@Unique(['userId', 'missionId'])
export class UserMission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  missionId: number;

  @Column({ nullable: true })
  latestMissionCodeId: number;

  @Column({ default: false })
  isCompleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date;

  @ManyToOne(() => Mission, (mission) => mission.userMissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'missionId' })
  mission: Mission;

  @ManyToOne(() => User, (user) => user.userMissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => MissionChat, (chat) => chat.userMission)
  missionChats: MissionChat[];

  @OneToMany(() => MissionCode, (code) => code.userMission)
  missionCodes: MissionCode[];
}
