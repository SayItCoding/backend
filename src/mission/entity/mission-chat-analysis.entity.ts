import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
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
  globalIntent:
    | 'TASK_CODE'
    | 'QUESTION_DEBUG'
    | 'QUESTION_CONCEPT'
    | 'QUESTION_MISSION_HINT'
    | 'EXPLANATION_CODE'
    | 'EXPLANATION_FEEDBACK'
    | 'SMALL_TALK'
    | 'OTHER'
    | 'UNKNOWN';

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

  // 포함된 taskType들 (중복 제거)
  @Column({ type: 'jsonb', nullable: true })
  taskTypes:
    | ('CREATE_CODE' | 'EDIT_CODE' | 'DELETE_CODE' | 'REFACTOR_CODE')[]
    | null;

  // 포함된 questionType들 (중복 제거)
  @Column({ type: 'jsonb', nullable: true })
  questionTypes:
    | (
        | 'WHY_WRONG'
        | 'HOW_TO_FIX'
        | 'WHAT_IS_CONCEPT'
        | 'DIFFERENCE_CONCEPT'
        | 'REQUEST_HINT'
        | 'REQUEST_EXPLANATION'
      )[]
    | null;

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

  // 포함된 ambiguityType들 (중복 제거)
  @Column({ type: 'jsonb', nullable: true })
  ambiguityTypes:
    | (
        | 'REPEAT_COUNT_MISSION'
        | 'RANGE_SCOPE_VAGUE'
        | 'UNSUPPORTED_ACTION'
        | 'DIRECTION_VAGUE'
        | 'COUNT_OR_LOOP_AMBIGUOUS'
        | 'LOOP_SCOPE_VAGUE'
        | 'OTHER'
      )[]
    | null;

  // IntentItem 전체(raw) 보관
  @Column({ type: 'jsonb' })
  rawIntent: any;

  @CreateDateColumn()
  createdAt: Date;
}
