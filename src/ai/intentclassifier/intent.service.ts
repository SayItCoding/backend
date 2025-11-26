// src/ai/intentclassifier/intent.service.ts
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { OpenAIClient } from '../openai/openai.client';
import { INTENT_JSON_SCHEMA, Slot, IntentOutput } from './intent.schema';
import { z } from 'zod';
import {
  createTriggerBlock,
  buildBlocksFromSlot,
} from 'src/utils/entry/blockBuilder';
import {
  normalizeScripts,
  applyScripts,
} from '../../utils/entry/scriptBuilder';
import { buildCodeSummaryFromScripts } from 'src/utils/entry/codeSummary';
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
export type SlotT = z.infer<typeof Slot>;
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

  async classify(utterance: string): Promise<IntentOutputT> {
    const client = this.openai.getClient();

    const systemPrompt = INTENT_SYSTEM_PROMPT;
    const userPrompt = buildIntentUserPrompt(utterance);

    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'IntentOutput',
          schema: INTENT_JSON_SCHEMA,
          strict: true,
        },
      },
    });

    const jsonText = response.output_text!;
    const intentOutput = IntentOutput.parse(JSON.parse(jsonText));

    return intentOutput;
  }

  async conversation(
    utterance: string,
    intentOutput: IntentOutputT,
    projectData: any,
    map?: string,
    char_location?: string,
    direction?: string,
  ): Promise<string> {
    const client = this.openai.getClient();

    const scripts = projectData?.objects?.[0]?.script ?? [[]];
    const codeSummary = buildCodeSummaryFromScripts(scripts);
    //console.log(codeSummary);

    const systemPrompt = CONVERSATION_SYSTEM_PROMPT;
    const userPrompt = buildConversationUserPrompt(
      utterance,
      intentOutput,
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
    if (latestMissionCodeId == null) {
      // 아직 유저 코드가 없으니 기본 projectData
      projectData = await this.missionService.getDefaultProjectData(missionId);
    } else {
      // 유저가 마지막으로 사용한 코드 스냅샷을 DB에서 읽어오기
      const latest = await this.missionCodeRepo.findOne({
        where: { id: latestMissionCodeId },
      });
      projectData = latest?.projectData;
    }

    const start1 = performance.now();
    // 1) Intent 분류 + slot 추출
    const intentOutput = await this.classify(utterance);
    const end1 = performance.now();
    console.log('의도 분류 응답 시간:', end1 - start1, 'ms');
    console.log(intentOutput);

    let updatedProjectData = projectData;

    // 2) slots 순서대로 적용 : intent → 코드 처리
    if (intentOutput.slots && intentOutput.slots.length > 0) {
      for (const slot of intentOutput.slots) {
        switch (slot.intent) {
          case 'MAKE_CODE': {
            updatedProjectData = await this.handleMakeCodeFromSlot(
              updatedProjectData,
              slot,
            );
            break;
          }

          case 'EDIT_CODE': {
            updatedProjectData = await this.handleEditCodeFromSlot(
              updatedProjectData,
              slot,
            );
            break;
          }

          default:
            break;
        }
      }
    }

    const start2 = performance.now();
    // 3) 자연어 답변 생성
    const message = await this.conversation(
      utterance,
      intentOutput,
      updatedProjectData, // 최신 코드 상태
      map,
      char_location,
      direction,
    );
    const end2 = performance.now();
    console.log('대화 처리 응답 시간:', end2 - start2, 'ms');

    // TODO: DB에 해당 로그 저장

    // 4) 통합 응답
    return {
      intent: intentOutput,
      message,
      projectData: updatedProjectData,
    };
  }

  private async handleMakeCodeFromSlot(projectData?: any, slot?: any) {
    //console.log('handleMakeCodeFromSlot', { slot });

    // 1) script 파싱 (objects[0].script 기준)
    const { scripts, sourceType } = normalizeScripts(projectData);

    // 2) slots → 엔트리 블록 생성
    const newBlocks = buildBlocksFromSlot(slot);

    //console.log(newBlocks);

    // 3) scripts[0] 없으면 트리거 블록 생성
    if (!scripts[0]) {
      scripts[0] = [createTriggerBlock()];
    }

    // 4) 맨 뒤에 붙이기
    scripts[0].push(...newBlocks);

    // 5) script를 다시 objects[0].script에 적용
    const updatedProjectData = applyScripts(projectData, scripts, sourceType);

    return updatedProjectData;
  }

  private async handleEditCodeFromSlot(projectData?: any, slot?: any) {
    console.log('handle Edit Code');
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
