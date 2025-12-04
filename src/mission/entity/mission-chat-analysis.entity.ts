import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import {
  TaskType,
  QuestionType,
  AmbiguityType,
} from '../../ai/intentclassifier/intent.schema';
import { MissionChat } from './mission-chat.entity';

@Entity('mission_chat_analyses')
export class MissionChatAnalysis {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => MissionChat, (chat) => chat.analysis, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'chatId' })
  chat: MissionChat;

  @Column()
  chatId: number;

  // IntentItem.globalIntent
  @Column({
    type: 'varchar',
    length: 40,
  })
  globalIntent: 'TASK_CODE' | 'QUESTION' | 'SMALL_TALK' | 'OTHER' | 'UNKNOWN';

  // IntentItem.confidence
  @Column({ type: 'float', default: 0.8 })
  confidence: number;

  // IntentItem.slots 전체
  @Column({ type: 'jsonb' })
  slots: any;

  // slots.length
  @Column({ type: 'int' })
  slotCount: number;

  // 코드 작업 의도 존재 여부 (slots.some(taskType != null))
  @Column({ type: 'boolean', default: false })
  hasTaskCode: boolean;

  // 질문 의도 존재 여부 (slots.some(questionType != null))
  @Column({ type: 'boolean', default: false })
  hasQuestion: boolean;

  // 포함된 taskType들
  @Column('text', { array: true, nullable: true })
  taskTypes: TaskType[] | null;

  // 포함된 questionType들
  @Column('text', { array: true, nullable: true })
  questionTypes: QuestionType[] | null;

  // 반복(루프) 관련 의도 존재 여부
  @Column({ type: 'boolean', default: false })
  hasLoopIntent: boolean;

  // loopCount 통계
  @Column({ type: 'int', nullable: true })
  avgLoopCount: number | null;

  @Column({ type: 'int', nullable: true })
  maxLoopCount: number | null;

  // 모호성 존재 여부 (slots.some(needsClarification))
  @Column({ type: 'boolean', default: false })
  hasAmbiguity: boolean;

  // 포함된 ambiguityType들
  @Column('text', { array: true, nullable: true })
  ambiguityTypes: AmbiguityType[] | null;

  // IntentItem 전체(raw) 보관
  @Column({ type: 'jsonb' })
  rawIntent: any;

  @CreateDateColumn()
  createdAt: Date;
}
