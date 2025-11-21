import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('mission_codes')
export class MissionCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userMissionId: number;

  @Column({ type: 'jsonb' })
  projectData: any;

  @CreateDateColumn()
  createdAt: Date;
}
