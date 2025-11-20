import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('intent_logs')
export class IntentLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'text' })
  utterance: string;

  @Column({ type: 'varchar', length: 32 })
  primaryIntent: string; // MAKE_CODE, EDIT_CODE, ...

  @Column({ type: 'jsonb', nullable: true })
  intents: any; // 전체 intents 배열

  @Column({ type: 'jsonb', nullable: true })
  slots: any; // slots (action, count, direction ...)

  @Column({ type: 'boolean', default: false })
  needsClarification: boolean;

  @Column({ type: 'text', nullable: true })
  assistantMessage: string; // conversation() 결과

  @Column({ type: 'jsonb', nullable: true })
  projectDataSnapshot: any; // 변경된 projectData (Entry 프로젝트 JSON 스냅샷)

  @CreateDateColumn()
  createdAt: Date;
}
