import { IntentItemT, TaskType } from './intent.schema';

export function checkMultiTaskSupport(intent: IntentItemT): {
  supported: boolean;
  reason?: 'MIXED_TASK_TYPE' | 'NON_CREATE_MULTI';
} {
  const slots = intent.slots ?? [];
  if (slots.length <= 1) {
    // 단일 명령은 항상 그대로 통과 (다른 guard에서 처리)
    return { supported: true };
  }

  const taskTypes = slots
    .map((s) => s.taskType as TaskType)
    .filter((t): t is Exclude<TaskType, null> => t !== null);

  // 전부 null 이면(순수 질문 발화 등) → 여기 규칙은 적용하지 않음
  if (taskTypes.length === 0) {
    return { supported: true };
  }

  const unique = Array.from(new Set(taskTypes));

  // 1) 타입이 섞여 있으면 (CREATE + EDIT 등) → unsupported
  if (unique.length > 1) {
    return { supported: false, reason: 'MIXED_TASK_TYPE' };
  }

  // 2) 한 가지 타입이긴 한데, 그게 CREATE_CODE가 아니면 → unsupported
  if (unique[0] !== 'CREATE_CODE') {
    return { supported: false, reason: 'NON_CREATE_MULTI' };
  }

  // 3) 전부 CREATE_CODE인 경우만 지원
  return { supported: true };
}

export function normalizeIntentForMultiTask(
  intent: IntentItemT,
  utterance: string,
): IntentItemT {
  const { supported, reason } = checkMultiTaskSupport(intent);
  if (supported) return intent;

  // 기존 슬롯은 버리고, "UNSUPPORTED_COMBINATION" 하나만 남기는 식으로 단순화
  return {
    ...intent,
    // 다중 명령이지만, 이번 턴은 "TASK_CODE" 중심이라고 가정
    globalIntent: 'TASK_CODE',
    slots: [
      {
        // 질문/코드 엔진용으로는 "한 턴에 처리 불가"를 의미하는 synthetic slot
        taskType: null,
        action: null,
        editMode: null,
        refactMode: null,
        count: null,
        loopExplicit: null,
        loopCount: null,
        targetScope: null,
        rangeAnchor: null,
        rangeCount: null,
        rangeIndexFrom: null,
        rangeIndexTo: null,
        questionType: null,
        rawSpan: utterance,
        reasoning:
          reason === 'MIXED_TASK_TYPE'
            ? '한 문장 안에서 코드 추가, 수정, 삭제 같은 서로 다른 종류의 작업을 동시에 요청했기 때문에, 이번 턴에서는 지원하지 않도록 판단했습니다.'
            : '여러 개의 코드 작업을 한꺼번에 요청했지만, 현재는 여러 줄을 한꺼번에 수정/삭제/리팩터링하는 다중 작업은 지원하지 않도록 설정되어 있습니다.',
        needsClarification: false,
        ambiguityType: null,
        ambiguityMessage: null,
        limitationType: 'UNSUPPORTED_COMBINATION',
        limitationMessage:
          '현재는 한 번에 여러 종류의 코드 작업을 동시에 처리하지 않고, 한 번에 한 가지 종류의 작업만 수행하도록 제한하고 있습니다.',
      },
    ],
  };
}
