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
  insertBlocksAt,
  replaceBlocksAt,
  deleteBlocksRange,
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
    //console.log('handleEditCodeFromSlot', { slot });
    if (slot.editMode === null) return;

    // 1) script 파싱 (objects[0].script 기준)
    const { scripts, sourceType } = normalizeScripts(projectData);

    // EIDT_CODE 인데 편집할 코드가 없는 경우
    if (!scripts || scripts.length === 0) return;

    // 2) slots → 엔트리 블록 생성
    const newBlocks = buildBlocksFromSlot(slot);

    const mainScript = scripts[0] ?? [];
    const currentLength = scripts[0].length;

    // 3) slot 정보를 바탕으로 삽입 인덱스를 계산
    let insertIndex = this.resolveInsertIndexFromSlot(slot, currentLength);

    // 삽입 인덱스 계산 불가
    if (insertIndex === null) return;

    // 범위 검사
    if (insertIndex < 1 || insertIndex >= currentLength) return;

    let newScript: any[];
    switch (slot.editMode) {
      case 'INSERT': {
        newScript = insertBlocksAt(mainScript, insertIndex, newBlocks);
        const newScripts = [...scripts];
        newScripts[0] = newScript;

        const updatedProjectData = applyScripts(
          projectData,
          newScripts,
          sourceType,
        );

        return updatedProjectData;
      }
      case 'REPLACE': {
        newScript = replaceBlocksAt(mainScript, insertIndex, newBlocks, 1);
        const newScripts = [...scripts];
        newScripts[0] = newScript;

        const updatedProjectData = applyScripts(
          projectData,
          newScripts,
          sourceType,
        );

        return updatedProjectData;
      }
      default: {
      }
    }
  }

  private async handleDeleteCodeFromSlot(projectData?: any, slot?: any) {
    //console.log('handleDeleteCodeFromSlot', { slot });
    const FIRST_EDITABLE_INDEX = 1;

    // 1) script 파싱 (objects[0].script 기준)
    const { scripts, sourceType } = normalizeScripts(projectData);

    // DELETE_CODE 인데 삭제할 코드가 없는 경우
    if (!scripts || scripts.length === 0) return;

    const mainScript = scripts[0] ?? [];
    const currentLength = scripts[0].length;

    const { startIndex, endIndex } = this.resolveDeleteRangeFromSlot(
      slot,
      currentLength,
    );

    // 삭제 범위 해석 불가
    if (startIndex == null || endIndex == null) return;

    // 유효하지 않은 범위
    if (
      startIndex < FIRST_EDITABLE_INDEX ||
      endIndex < FIRST_EDITABLE_INDEX ||
      startIndex > endIndex ||
      endIndex >= currentLength
    )
      return;

    const newScript = deleteBlocksRange(mainScript, startIndex, endIndex);

    const newScripts = [...scripts];
    newScripts[0] = newScript;

    const updatedProjectData = applyScripts(
      projectData,
      newScripts,
      sourceType,
    );

    return updatedProjectData;
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

  private resolveInsertIndexFromSlot(
    slot: any,
    currentLength: number,
  ): number | null {
    const FIRST_EDITABLE_INDEX = 1;
    const { rangeIndexFrom, rangeAnchor } = slot;

    // n번째 줄 (트리거 블록 제외한 n번째)
    if (typeof rangeIndexFrom === 'number') {
      return rangeIndexFrom;
    }

    // 맨 앞
    if (rangeAnchor === 'HEAD') return FIRST_EDITABLE_INDEX;

    if (rangeAnchor === 'TAIL') return currentLength;

    return null;
  }

  private resolveDeleteRangeFromSlot(
    slot: any,
    length: number,
  ): { startIndex: number | null; endIndex: number | null } {
    const {
      rangeIndexFrom,
      rangeIndexTo,
      rangeAnchor,
      rangeCount,
      targetScope,
    } = slot ?? {};

    // 처음 / 마지막 줄 번호
    const FIRST_EDITABLE_INDEX = 1;
    const LAST_EDITABLE_INDEX = length - 1;

    // 명시적인 인덱스 범위: "n번째 줄", "n번째~m번째 줄"
    if (typeof rangeIndexFrom === 'number') {
      const from = rangeIndexFrom;
      const to =
        typeof rangeIndexTo === 'number' ? rangeIndexTo : rangeIndexFrom; // 한 줄만 지우는 경우

      return {
        startIndex: from,
        endIndex: to,
      };
    }

    // HEAD + rangeCount: "위에 있는 두 줄 지워줘"
    if (rangeAnchor === 'HEAD' && typeof rangeCount === 'number') {
      const startIndex = FIRST_EDITABLE_INDEX;
      const endIndex = FIRST_EDITABLE_INDEX + rangeCount - 1;
      return { startIndex, endIndex };
    }

    // TAIL + rangeCount: "마지막 세 줄 지워줘"
    if (rangeAnchor === 'TAIL' && typeof rangeCount === 'number') {
      const endIndex = LAST_EDITABLE_INDEX;
      const startIndex = LAST_EDITABLE_INDEX - rangeCount + 1;
      return { startIndex, endIndex };
    }

    // ALL_CODE: 트리거 제외 전체 삭제
    if (targetScope === 'ALL_CODE') {
      if (LAST_EDITABLE_INDEX < FIRST_EDITABLE_INDEX) {
        return {
          startIndex: null,
          endIndex: null,
        };
      }
      return {
        startIndex: FIRST_EDITABLE_INDEX,
        endIndex: LAST_EDITABLE_INDEX,
      };
    }

    // 그외 해석 불가
    return {
      startIndex: null,
      endIndex: null,
    };
  }
}
