// src/ai/intentclassifier/intent.schema.ts
import * as z from 'zod';

/**
 * 개별 Slot (한 문장 안의 “행동/요청” 최소 단위)
 */
export const Slot = z.object({
  // 코드 작업 종류
  taskType: z
    .enum(['CREATE_CODE', 'EDIT_CODE', 'DELETE_CODE', 'REFACTOR_CODE'])
    .nullable(),

  // 실제 행동 블록
  action: z.enum(['move_forward', 'turn_left', 'turn_right']).nullable(),

  // EDIR_CODE 하위 분류
  editMode: z.enum(['INSERT', 'REPLACE']).nullable(),

  // 한 번 실행 시 몇 칸/몇 회
  count: z.number().int().positive().nullable(),

  // 반복 의도
  loopExplicit: z.boolean().nullable(),

  // 몇 번 반복할지
  loopCount: z.number().int().positive().nullable(),

  // 코드 대상 범위
  targetScope: z.enum(['SELECTED_BLOCK', 'BLOCK_RANGE', 'ALL_CODE']).nullable(),

  // BLOCK_RANGE 상세 정보
  rangeAnchor: z.enum(['HEAD', 'TAIL']).nullable(),
  rangeCount: z.number().int().positive().nullable(),
  rangeIndexFrom: z.number().int().positive().nullable(),
  rangeIndexTo: z.number().int().positive().nullable(),

  // 질문 유형
  questionType: z
    .enum([
      'WHY_WRONG',
      'HOW_TO_FIX',
      'WHAT_IS_CONCEPT',
      'DIFFERENCE_CONCEPT',
      'REQUEST_HINT',
      'REQUEST_EXPLANATION',
    ])
    .nullable(),

  // 이 slot에 대응하는 원문 일부
  rawSpan: z.string().nullable(),

  // 이 해석을 한 이유(간단 설명)
  reasoning: z.string().nullable(),

  // 학생에게 추가로 물어봐야 할 정도로 모호한지
  needsClarification: z.boolean().nullable(),

  // 모호성 유형
  ambiguityType: z
    .enum([
      'REPEAT_COUNT_MISSION', // 반복 횟수 없음
      'RANGE_SCOPE_VAGUE', // 어느 줄을 말하는지 불명확
      'UNSUPPORTED_ACTION', // 지원하지 않는 행동
      'DIRECTION_VAGUE', // 방향 모호
      'COUNT_OR_LOOP_AMBIGUOUS', //
      'LOOP_SCOPE_VAGUE', // 전체 or 일부 반복
      'OTHER',
    ])
    .nullable(),
  ambiguityMessage: z.string().nullable(),
});

/**
 * Intent 전체 구조
 */
export const IntentItem = z.object({
  globalIntent: z.enum([
    'TASK_CODE',
    'QUESTION_DEBUG',
    'QUESTION_CONCEPT',
    'QUESTION_MISSION_HINT',
    'EXPLANATION_CODE',
    'EXPLANATION_FEEDBACK',
    'SMALL_TALK',
    'OTHER',
    'UNKNOWN',
  ]),
  slots: z.array(Slot).default([]),
  confidence: z.number().min(0).max(1).default(0.8),
});

export type IntentItemT = z.infer<typeof IntentItem>;

/**
 * OpenAI responses용 JSON Schema
 */
export const INTENT_JSON_SCHEMA = z.toJSONSchema(IntentItem);
