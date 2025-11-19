// src/ai/intentclassifier/intent.service.ts
import { Injectable } from '@nestjs/common';
import { OpenAIClient } from '../../openai/openai.client';
import { INTENT_JSON_SCHEMA, IntentOutput } from './intent.schema';
import { z } from 'zod';
import { Slot } from 'src/utils/entry/blockTypes';
import {
  createTriggerBlock,
  buildBlocksFromSlots,
} from 'src/utils/entry/blockBuilder';
import {
  normalizeScripts,
  applyScripts,
} from '../../utils/entry/scriptBuilder';

// Zod 스키마에서 타입 뽑아오기
export type IntentOutputT = z.infer<typeof IntentOutput>;

@Injectable()
export class IntentService {
  constructor(private readonly openai: OpenAIClient) {}

  async classify(
    utterance: string,
    projectData: any,
    map: string,
    char_location: string,
    direction: string,
  ) {
    const client = this.openai.getClient();

    const systemPrompt = `
당신은 코딩학습용 게임에서 사용자 입력 의도를 분석하는 전문가입니다.
반드시 유효한 JSON만 출력하세요.
JSON 외의 텍스트, 설명, 마크업을 절대 포함하지 마세요.
`;

    const userPrompt = `
## 컨텍스트
- 맵 정보: ${map}
- 캐릭터 위치: ${char_location}
- 캐릭터가 보고있는 방향: ${direction}

## 작업
사용자 입력의 의도를 다음 중 하나로 분류하세요:
- MAKE_CODE: 코드/행동을 "작성·생성·실행 지시" (예: "앞으로 3칸 가는 코드 만들어줘", "두 칸 더")
- EDIT_CODE: 기존 코드의 "수정·추가·리팩터" (예: "반복문으로 바꿔줘", "왼쪽 회전 로직만 고쳐")
- QUESTION: 오류/원인/방법을 묻는 질문 (예: "왜 오류 나지?", "for문이 더 좋은 이유는?")
- EXPLANATION: 개념/원리/용법 일반 설명 요청 (예: "while과 for 차이 설명해줘")
- OTHER: 위에 해당하지 않는 일반 대화/잡담/시스템 외 요청
- UNKNOWN: 의미가 불명확하여 안전하게 분류 불가

컨텍스트 활용 규칙:
- 직전 상태가 코드 작성 흐름이고, 입력이 짧은 명령형(예: "두 칸 더", "왼쪽!")이면 MAKE_CODE에 가산점을 부여.
- 현재 맵/위치/방향과 모순되는 지시는 여전히 MAKE_CODE가 될 수 있으나, reasoning에 "환경과 불일치"를 명시.
- 질문+지시가 섞이면 다중 의도로 기록하되 primary는 "사용자가 즉시 원하는 것"을 우선.

슬롯 추출(가능할 때만):
- action: move | turn | repeat
- count: 정수 | null
- direction: left | right | forward | backward | null
- target: 수정 대상 식별자(함수/블록명) 또는 null
- loop_explicit:
  - true: 사용자가 "반복", "~번 반복", "for문", "while문" 등 **반복 구조 자체를 명시적으로 요청**한 경우
    - 예: "앞으로 2칸 반복해", "이 동작 세 번 반복해", "for문으로 세 번 돌려"
  - false: 단순히 "앞으로 2칸 가", "왼쪽으로 세 번 돌아"처럼
    **횟수는 말했지만 반복문/루프라는 표현은 하지 않은 경우**

## 출력 형식(JSON만)
{
  "primary": "MAKE_CODE | EDIT_CODE | QUESTION | EXPLANATION | OTHER | UNKNOWN",
  "intents": [
    {"type":"MAKE_CODE","confidence":0.0},
    {"type":"EDIT_CODE","confidence":0.0},
    {"type":"QUESTION","confidence":0.0},
    {"type":"EXPLANATION","confidence":0.0},
    {"type":"OTHER","confidence":0.0},
    {"type":"UNKNOWN","confidence":0.0}
  ],
  "reasoning": "한국어로 1~2문장 판단 근거 (컨텍스트 반영)",
  "alternatives": [
    {"type":"...","confidence":0.0}
  ],
  "slots": {
    "action": null,
    "count": null,
    "direction": null,
    "language": null,
    "target": null
  },
  "needs_clarification": false
}

채점 규칙:
- confidence는 0.0~1.0로, 모든 intents의 합이 1일 필요는 없음.
- 가장 높은 confidence를 primary로 설정.
- 모호하면 needs_clarification=true로 표시하고 alternatives에 상위 1~2개 포함.
`.trim();

    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
        { role: 'user', content: utterance },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'IntentOutput',
          schema: INTENT_JSON_SCHEMA,
          strict: true,
        },
      },
      temperature: 0,
    });

    const jsonText = response.output_text!;
    const intentOutput = IntentOutput.parse(JSON.parse(jsonText));

    const input = {
      projectData,
    };

    switch (intentOutput.primary) {
      case 'MAKE_CODE':
        return this.handleMakeCode(input, intentOutput);
      case 'EDIT_CODE':
        return this.handleEditCode(intentOutput);
      case 'QUESTION':
        return this.handleQuestion(intentOutput);
      case 'EXPLANATION':
        return this.handleExplanation(intentOutput);
      case 'OTHER':
        return this.handleOther(intentOutput);
      case 'UNKNOWN':
      default:
        return this.handleUnknown(intentOutput);
    }
  }

  private async handleMakeCode(
    input: { projectData?: any },
    intent: IntentOutputT,
  ) {
    console.log('handle Make Code');
    const slots = intent.slots;

    //console.log(slots);

    // 1) script 파싱 (objects[0].script 기준)
    const { scripts, sourceType } = normalizeScripts(input.projectData);

    // 2) slots → 엔트리 블록 생성
    const newBlocks = buildBlocksFromSlots(slots);

    //console.log(newBlocks);

    // 3) scripts[0] 없으면 트리거 블록 생성
    if (!scripts[0]) {
      scripts[0] = [createTriggerBlock()];
    }

    // 4) 맨 뒤에 붙이기
    scripts[0].push(...newBlocks);

    // 5) script를 다시 objects[0].script에 적용
    const updatedProjectData = applyScripts(
      input.projectData,
      scripts,
      sourceType,
    );

    return {
      projectData: updatedProjectData,
    };
  }

  private async handleEditCode(intent: IntentOutputT) {
    console.log('handle Edit Code');
  }

  private async handleQuestion(intent: IntentOutputT) {
    console.log('handle Question');
  }

  private async handleExplanation(intent: IntentOutputT) {
    console.log('handle Explanation');
  }

  private async handleOther(intent: IntentOutputT) {
    console.log('handle Other');
  }

  private async handleUnknown(intent: IntentOutputT) {
    console.log('handle Unknown');
  }
}
