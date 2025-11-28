// src/ai/intentclassifier/intent.service.ts
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { OpenAIClient } from '../openai/openai.client';
import { INTENT_JSON_SCHEMA, IntentItem, IntentItemT } from './intent.schema';
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

type MissionContext = {
  map?: string[][];
  start?: { x: number; y: number };
  goal?: { x: number; y: number };
  end?: { x: number; y: number };
  initialDirection?: string;
};

@Injectable()
export class IntentService {
  constructor(
    @InjectRepository(MissionCode)
    private missionCodeRepo: Repository<MissionCode>,
    private readonly openai: OpenAIClient,

    @Inject(forwardRef(() => MissionService))
    private readonly missionService: MissionService,
  ) {}

  async classify(utterance: string): Promise<IntentItemT> {
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
          name: 'IntentItem',
          schema: INTENT_JSON_SCHEMA,
          strict: true,
        },
      },
    });

    const jsonText = response.output_text!;
    const intentItem = IntentItem.parse(JSON.parse(jsonText));

    return intentItem;
  }

  async conversation(
    utterance: string,
    intentItem: IntentItemT,
    projectData: any,
    missionContext?: MissionContext,
  ): Promise<string> {
    const client = this.openai.getClient();

    const scripts = projectData?.objects?.[0]?.script ?? [[]];
    const codeSummary = buildCodeSummaryFromScripts(scripts);
    //console.log(codeSummary);

    const systemPrompt = CONVERSATION_SYSTEM_PROMPT;
    const userPrompt = buildConversationUserPrompt(
      utterance,
      intentItem,
      codeSummary,
      missionContext,
    );
    //console.log('conversation userPrompt', userPrompt);

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
  }) {
    const { missionId, latestMissionCodeId, utterance } = params;

    const missionContext =
      await this.missionService.getMissionContext(missionId);

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

    //console.log(projectData);

    const start1 = performance.now();
    // 1) Intent 분류 + slot 추출
    const intentItem = await this.classify(utterance);
    const end1 = performance.now();
    console.log('의도 분류 응답 시간:', end1 - start1, 'ms');
    //console.log(intentOutput);

    let updatedProjectData = projectData;
    let didChangeCode = false;

    const isTaskCode = intentItem.globalIntent === 'TASK_CODE';
    // 2) TASK_CODE 인 경우 slots을 사용해 코드 변경
    if (isTaskCode && intentItem.slots && intentItem.slots.length > 0) {
      for (const slot of intentItem.slots) {
        if (slot.needsClarification) continue; // 모호한 slot은 적용 X

        const before = updatedProjectData;
        switch (slot.taskType) {
          case 'CREATE_CODE': {
            updatedProjectData = await this.handleCreateCodeFromSlot(
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

          case 'DELETE_CODE': {
            updatedProjectData = await this.handleDeleteCodeFromSlot(
              updatedProjectData,
              slot,
            );
            break;
          }

          case 'REFACTOR_CODE': {
            updatedProjectData = await this.handleRefactorCodeFromSlot(
              updatedProjectData,
              slot,
            );
            break;
          }

          default:
            break;
        }
        // object reference가 바뀌었으면 코드 변경이 일어났다고 간주
        if (updatedProjectData !== before) {
          didChangeCode = true;
        }
      }
    } else {
      // TASK_CODE가 아니면 코드 변경 없음
    }

    const start2 = performance.now();
    // 3) 자연어 답변 생성
    const message = await this.conversation(
      utterance,
      intentItem,
      updatedProjectData, // 최신 코드 상태 (또는 변경 없음)
      missionContext, // 컨텍스트 반영
    );
    const end2 = performance.now();
    console.log('대화 처리 응답 시간:', end2 - start2, 'ms');

    // TODO: DB에 api 처리 결과 로그 저장

    // 4) 통합 응답
    return {
      intent: intentItem,
      message,
      projectData: updatedProjectData,
      didChangeCode,
    };
  }

  private async handleCreateCodeFromSlot(projectData?: any, slot?: any) {
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

  private async handleDeleteCodeFromSlot(projectData?: any, slot?: any) {
    console.log('handle Delete Code');
  }

  private async handleRefactorCodeFromSlot(projectData?: any, slot?: any) {
    console.log('handle Refactor Code');
  }

  private async handleQuestion() {
    console.log('handle Question');
  }

  private async handleExplanation() {
    console.log('handle Explanation');
  }

  private async handleOther() {
    console.log('handle Other');
  }

  private async handleUnknown() {
    console.log('handle Unknown');
  }
}
