// src/ai/intentclassifier/intent.schema.ts
import * as z from 'zod';

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

export const IntentOutput = z.object({
  primary: IntentItem.shape.type,
  intents: z.array(IntentItem).length(6),
  reasoning: z.string(),
  alternatives: z.array(IntentItem).optional().default([]),
  slots: z.object({
    action: z.enum(['move', 'turn', 'repeat']).nullable(),
    count: z.number().int().positive().nullable(),
    direction: z
      .enum([
        'left',
        'right',
        'forward',
        'backward',
        'north',
        'south',
        'east',
        'west',
      ])
      .nullable(),
    language: z.string().nullable(),
    target: z.string().nullable(),
  }),
  needs_clarification: z.boolean(),
});

export type IntentOutputT = z.infer<typeof IntentOutput>;

// ⬇ Zod v4 내장 변환기로 JSON Schema 생성 (별도 패키지 불필요)
export const INTENT_JSON_SCHEMA = z.toJSONSchema(IntentOutput);
