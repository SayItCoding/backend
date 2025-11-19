// src/badge/badge.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BadgeConditionType } from './badge-condition-type.enum';

@Entity('badges')
export class Badge {
  @PrimaryGeneratedColumn()
  id: number;

  // "FIRST_MISSION", "MISSION_10_CLEAR" 같은 코드
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  iconUrl: string;

  @Column({
    type: 'enum',
    enum: BadgeConditionType,
  })
  conditionType: BadgeConditionType;

  // 기본 숫자 기준 (예: 10개, 60분, 7일 등)
  @Column({ type: 'int' })
  threshold: number;

  // 세부 조건이 더 필요하면 여기(JSONB)에
  // ex) { missionCategory: 'BASIC' }
  @Column({ type: 'jsonb', nullable: true })
  conditionMeta: Record<string, any> | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
