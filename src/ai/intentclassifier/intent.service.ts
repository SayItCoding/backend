// src/ai/intentclassifier/intent.service.ts
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { OpenAIClient } from '../openai/openai.client';
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
import {
  INTENT_SYSTEM_PROMPT,
  buildIntentUserPrompt,
  CONVERSATION_SYSTEM_PROMPT,
  buildConversationUserPrompt,
} from './prompt';
import { MissionService } from 'src/mission/mission.service';
import { MissionCode } from 'src/mission/entity/mission-code.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

// Zod 스키마에서 타입 뽑아오기
export type IntentOutputT = z.infer<typeof IntentOutput>;

@Injectable()
export class IntentService {
  constructor(
    @InjectRepository(MissionCode)
    private missionCodeRepo: Repository<MissionCode>,
    private readonly openai: OpenAIClient,

    @Inject(forwardRef(() => MissionService))
    private readonly missionService: MissionService,
  ) {}

  async classify(
    utterance: string,
    projectData: any,
    map?: string,
    char_location?: string,
    direction?: string,
  ): Promise<IntentOutputT> {
    const client = this.openai.getClient();

    // 코드 요약 생성 (그대로 두고, 프롬프트로 넘겨주기만)
    let codeSummary = '';
    try {
      const script = projectData?.objects?.[0]?.script ?? [];
      const raw = JSON.stringify(script, null, 2);
      codeSummary =
        raw.length > 1500 ? raw.slice(0, 1500) + '\n... (truncated)' : raw;
    } catch {
      codeSummary = '[코드 요약 불가]';
    }

    const systemPrompt = INTENT_SYSTEM_PROMPT;
    const userPrompt = buildIntentUserPrompt(
      codeSummary,
      map,
      char_location,
      direction,
    );

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

    return intentOutput;
  }

  async conversation(
    utterance: string,
    intent: IntentOutputT,
    projectData: any,
    map?: string,
    char_location?: string,
    direction?: string,
  ): Promise<string> {
    const client = this.openai.getClient();

    let codeSummary = '';
    try {
      const script = projectData?.objects?.[0]?.script ?? [];
      const raw = JSON.stringify(script, null, 2);
      codeSummary =
        raw.length > 1500 ? raw.slice(0, 1500) + '\n... (truncated)' : raw;
    } catch {
      codeSummary = '[코드 요약 불가]';
    }

    const systemPrompt = CONVERSATION_SYSTEM_PROMPT;
    const userPrompt = buildConversationUserPrompt(
      utterance,
      intent,
      codeSummary,
      map,
      char_location,
      direction,
    );

    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
    });

    const text = response.output_text ?? '';
    return text.trim();
  }

  async process(params: {
    missionId: number;
    latestMissionCodeId: number | null;
    utterance: string;
    map?: string;
    char_location?: string;
    direction?: string;
  }) {
    const {
      missionId,
      latestMissionCodeId,
      utterance,
      map,
      char_location,
      direction,
    } = params;
    let projectData;
    // 아무 코드가 없으면 mission의 기본 projectData 불러오기
    if (latestMissionCodeId != null) {
      projectData = await this.missionService.getDefaultProjectData(missionId);
    } else {
      projectData = await this.missionCodeRepo.find;
    }

    // 1) Intent 분류 + slot 추출
    const intentOutput = await this.classify(
      utterance,
      projectData,
      map,
      char_location,
      direction,
    );

    let updatedProjectData = projectData;

    // 2) intent → 코드 처리
    switch (intentOutput.primary) {
      case 'MAKE_CODE':
        updatedProjectData = (
          await this.handleMakeCode({ projectData }, intentOutput)
        ).projectData;
        break;

      case 'EDIT_CODE':
        break;

      default:
        // QUESTION, EXPLANATION, OTHER, UNKNOWN
        // 코드 변경 없음
        updatedProjectData = projectData;
    }

    // 3) 자연어 답변 생성
    const message = await this.conversation(
      utterance,
      intentOutput,
      updatedProjectData, // 최신 코드 상태
      map,
      char_location,
      direction,
    );

    // TODO: DB에 해당 로그 저장

    // 4) 통합 응답
    return {
      intent: intentOutput,
      message,
      projectData: updatedProjectData,
    };
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

  private async handleEditCode(
    input: { projectData?: any },
    intent: IntentOutputT,
  ) {
    console.log('handle Edit Code');
    /**
     * TODO:
     * - intent.slots.target / action / count / direction 등을 사용해서
     *   projectData.objects[0].script 안의 특정 부분을 찾아 수정하는 로직을 넣으면 됨.
     * - 지금은 일단 "수정 안 하고 그대로 반환"하는 더미 구현.
     */
  }

  private async handleQuestion(
    input: { projectData?: any },
    intent: IntentOutputT,
  ) {
    console.log('handle Question');
  }

  private async handleExplanation(
    input: { projectData?: any },
    intent: IntentOutputT,
  ) {
    console.log('handle Explanation');
  }

  private async handleOther(
    input: { projectData?: any },
    intent: IntentOutputT,
  ) {
    console.log('handle Other');
  }

  private async handleUnknown(
    input: { projectData?: any },
    intent: IntentOutputT,
  ) {
    console.log('handle Unknown');
  }
}
