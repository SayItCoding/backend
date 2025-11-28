import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserMission } from './user-mission.entity';

@Entity('mission_codes')
export class MissionCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'jsonb' })
  projectData: any;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => UserMission, (userMission) => userMission.missionCodes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userMissionId' })
  userMission: UserMission;
}
