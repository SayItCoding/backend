import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserMission } from './user-mission.entity';

@Entity('missions')
export class Mission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  thumbnailUrl?: string;

  @Column({ nullable: true })
  category?: string;

  difficulty: number;

  // Entry 프로젝트 데이터 (JSON)
  @Column({ type: 'jsonb', name: 'projectdata' })
  projectData: {
    speed: number; // 작품 실행 속도 (FPS)
    objects: any[]; // 오브젝트 정보
    variables: any[]; // 변수 정보
    messages: any[]; // 신호 정보
    functions: any[]; // 함수 정보
    scenes: any[]; // 장면 정보
    interface: any[]; // 인터페이스 정보
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserMission, (userMission) => userMission.mission)
  userMissions: UserMission[];
}
