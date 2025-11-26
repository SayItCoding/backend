// src/ai/intentclassifier/intent.schema.ts
import * as z from 'zod';

// 개별 슬롯(한 개의 명령 단위)
export const Slot = z.object({
  intent: z.enum(['MAKE_CODE', 'EDIT_CODE']),
  action: z.enum(['move_forward', 'turn_left', 'turn_right']).nullable(),
  count: z.number().int().positive().nullable(),
  repeat: z.number().int().positive().nullable(),
  target: z.string().nullable(), // "SELECTED_BLOCK" 같은 값 사용 예정
  loop_explicit: z.boolean().default(false),
  reasoning: z.string(),
  alternatives: z.array(z.string()).default([]),
  needs_clarification: z.boolean().default(false),
});

// 런타임 검증용(Zod v4)
export const IntentItem = z.object({
  type: z.enum([
    'MAKE_CODE',
    'EDIT_CODE',
    'QUESTION',
    'EXPLANATION',
    'OTHER',
    'UNKNOWN',
  ]),
  confidence: z.number().min(0).max(1),
});

// 전체 출력 (slots를 배열로 변경)
export const IntentOutput = z.object({
  primary: IntentItem.shape.type,
  intents: z.array(IntentItem).length(6),
  reasoning: z.string(),
  alternatives: z.array(IntentItem).optional().default([]),

  // 여러 명령을 담는 배열
  slots: z.array(Slot),

  needs_clarification: z.boolean(),
});

export type SlotT = z.infer<typeof Slot>;
export type IntentOutputT = z.infer<typeof IntentOutput>;

export const INTENT_JSON_SCHEMA = z.toJSONSchema(IntentOutput);
