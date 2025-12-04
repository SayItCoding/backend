// src/ai/intentclassifier/intent.service.ts
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { OpenAIClient } from '../openai/openai.client';
import { INTENT_JSON_SCHEMA, IntentItem, IntentItemT } from './intent.schema';
import {
  createTriggerBlock,
  buildBlocksFromSlot,
  createRepeatBlock,
} from 'src/utils/entry/blockBuilder';
import { EntryBlock } from 'src/utils/entry/blockTypes';
import {
  normalizeScripts,
  applyScripts,
  insertBlocksAt,
  replaceBlocksAt,
  deleteBlocksRange,
  wrapBlocksRange,
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
import { normalizeIntentForMultiTask } from './multiTask.guard';

type SlotT = IntentItemT['slots'][number];

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

  async conversationLLM(params: {
    utterance: string;
    intentItem: IntentItemT;
    codeSummary?: string;
    missionContext?: MissionContext;
    useContext?: boolean;
  }): Promise<string> {
    const { utterance, intentItem, codeSummary, missionContext, useContext } =
      params;
    const client = this.openai.getClient();

    const systemPrompt = CONVERSATION_SYSTEM_PROMPT;
    let userPrompt;
    if (useContext) {
      userPrompt = buildConversationUserPrompt(
        utterance,
        intentItem,
        codeSummary ?? '현재 코드가 비어 있거나 요약 정보가 없습니다.',
        missionContext,
      );
    } else {
      userPrompt = buildConversationUserPrompt(utterance, intentItem);
    }

    console.log(userPrompt);

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
    const slots = intentItem.slots ?? [];
    const hasClarifySlot = slots.some((s) => s.needsClarification === true);

    // 2) TASK_CODE 인 경우, 모호한 slot이 전혀 없을 때만 slots을 사용해 코드 변경
    if (isTaskCode && slots.length > 0 && !hasClarifySlot) {
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

    // 3) codeSummary 생성 (질문 계열에서만 LLM에 넘길 요약 정보)
    const scripts = updatedProjectData?.objects?.[0]?.script ?? [[]];
    const codeSummary = buildCodeSummaryFromScripts(scripts);

    const start2 = performance.now();
    // 4) 자연어 답변 생성 (여기서 LLM 호출 여부/패턴을 모두 제어)
    const message = await this.buildReply({
      utterance,
      intentItem,
      codeSummary,
      missionContext,
    });
    const end2 = performance.now();
    console.log('대화 처리 응답 시간:', end2 - start2, 'ms');

    // TODO: DB에 api 처리 결과 로그 저장

    return {
      intent: intentItem,
      message,
      projectData: updatedProjectData,
      didChangeCode,
    };
  }

  private async handleCreateCodeFromSlot(projectData?: any, slot?: any) {
    console.log('handleCreateCodeFromSlot', { slot });

    // script 파싱 (objects[0].script 기준)
    const { scripts, sourceType } = normalizeScripts(projectData);
    const newBlocks = buildBlocksFromSlot(slot);

    // scripts[0] 없으면 트리거 블록 생성
    if (!scripts[0]) {
      scripts[0] = [createTriggerBlock()];
    }

    // 맨 뒤에 붙이기
    scripts[0].push(...newBlocks);

    // script를 다시 objects[0].script에 적용
    const updatedProjectData = applyScripts(projectData, scripts, sourceType);

    return updatedProjectData;
  }

  private async handleEditCodeFromSlot(projectData?: any, slot?: any) {
    const FIRST_EDITABLE_INDEX = 1;
    //console.log('handleEditCodeFromSlot', { slot });
    if (slot.editMode === null) return;

    // script 파싱 (objects[0].script 기준)
    const { scripts, sourceType } = normalizeScripts(projectData);

    // EIDT_CODE 인데 편집할 코드가 없는 경우
    if (!scripts || scripts.length === 0) return;

    const newBlocks = buildBlocksFromSlot(slot);

    const mainScript = scripts[0] ?? [];
    const currentLength = scripts[0].length;

    let newScript: any[];
    switch (slot.editMode) {
      case 'INSERT': {
        const insertIndex = this.resolveInsertIndexFromSlot(
          slot,
          currentLength,
        );
        // 삽입 인덱스 계산 불가
        if (insertIndex === null) return;
        // 범위 검사
        if (insertIndex < 1 || insertIndex >= currentLength) return;

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
        // 삭제/리팩
        const { startIndex, endIndex } = this.resolveRangeFromSlot(
          slot,
          currentLength,
        );

        if (startIndex == null || endIndex == null) return;

        // 유효하지 않은 범위
        if (
          startIndex < FIRST_EDITABLE_INDEX ||
          endIndex < FIRST_EDITABLE_INDEX ||
          startIndex > endIndex ||
          endIndex >= currentLength
        )
          return;

        newScript = replaceBlocksAt(
          mainScript,
          startIndex,
          newBlocks,
          endIndex - startIndex + 1,
        );
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

    // script 파싱 (objects[0].script 기준)
    const { scripts, sourceType } = normalizeScripts(projectData);

    // DELETE_CODE 인데 삭제할 코드가 없는 경우
    if (!scripts || scripts.length === 0) return;

    const mainScript = scripts[0] ?? [];
    const currentLength = scripts[0].length;

    const { startIndex, endIndex } = this.resolveRangeFromSlot(
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
    const FIRST_EDITABLE_INDEX = 1;
    //console.log('handleRefactorCodeFromSlot', { slot });

    // script 파싱 (objects[0].script 기준)
    const { scripts, sourceType } = normalizeScripts(projectData);

    if (!scripts || scripts.length === 0) return;

    const mainScript: EntryBlock[] = scripts[0] ?? [];
    const refactMode = slot.refactMode as string | null;

    // =========================================================
    // 1) MERGE_SAME_ACTIONS: 전체 범위를 스캔하면서 해당되는 모든 구간 병합
    // =========================================================
    if (refactMode === 'MERGE_SAME_ACTIONS') {
      if (mainScript.length <= FIRST_EDITABLE_INDEX) {
        // 트리거만 있고 편집 가능한 블록이 없음
        return projectData;
      }

      // action -> 실제 블록 타입으로 매핑
      const action = (slot.action as string | null) ?? null;

      const len = mainScript.length;
      const newMain: EntryBlock[] = [];

      for (let i = 0; i < len; ) {
        const block = mainScript[i];

        // 트리거 등 편집 불가 영역(0번 인덱스)은 그대로 둔다
        if (i < FIRST_EDITABLE_INDEX) {
          newMain.push(block);
          i++;
          continue;
        }

        const bType = (block as any)?.type;

        // 이 블록이 병합 대상인지 판단
        let isCandidate = false;

        if (action) {
          // action이 지정된 경우: 해당 타입만 병합
          isCandidate = bType === action;
        } else {
          // action 미지정: "연속된 같은 type" 이면 병합 후보
          const next = i + 1 < len ? (mainScript[i + 1] as any) : null;
          isCandidate = !!(next && next.type === bType);
        }

        if (!isCandidate) {
          newMain.push(block);
          i++;
          continue;
        }

        // 연속 구간(run) 찾기
        let j = i + 1;
        while (j < len && (mainScript[j] as any)?.type === bType) {
          j++;
        }
        const runLength = j - i;

        if (runLength <= 1) {
          // 안전장치 (실제로는 올 일 거의 없음)
          newMain.push(block);
          i++;
          continue;
        }

        // loopCount 결정
        let loopCount = slot.loopCount as number | null;
        if (typeof loopCount !== 'number' || loopCount <= 1) {
          // 지정 안 되어 있으면 "연속 길이"로
          loopCount = runLength;
        }

        if (loopCount <= 1) {
          // 반복 1번이면 감쌀 필요가 없음 → 원래 블록 그대로 유지
          for (let k = i; k < j; k++) {
            newMain.push(mainScript[k]);
          }
          i = j;
          continue;
        }

        // runLength 와 loopCount 관계에 따라 나누는 방식
        const bodyBlocks: EntryBlock[] = [block];

        if (runLength % loopCount === 0) {
          // runLength가 loopCount의 배수면, 여러 개의 반복문으로 균등 분할
          const repeatTimes = runLength / loopCount;
          for (let r = 0; r < repeatTimes; r++) {
            const rep = createRepeatBlock(loopCount, bodyBlocks);
            newMain.push(rep);
          }
        } else {
          // 애매한 경우: 연속 구간 전체를 loopCount로 한 번 감싼다
          const rep = createRepeatBlock(loopCount, bodyBlocks);
          newMain.push(rep);
        }

        i = j; // 다음 구간으로 이동
      }

      const newScripts = [...scripts];
      newScripts[0] = newMain;

      const updatedProjectData = applyScripts(
        projectData,
        newScripts,
        sourceType,
      );
      return updatedProjectData;
    }

    // =========================================================
    // 2) 그 외: 기존 WRAP_RANGE_IN_LOOP 스타일 (선택 범위를 반복문으로 감싸기)
    // =========================================================

    const mainScript2 = mainScript;
    const currentLength = mainScript2.length;

    const { startIndex, endIndex } = this.resolveRangeFromSlot(
      slot,
      currentLength,
    );

    if (startIndex == null || endIndex == null) return;

    if (
      startIndex < FIRST_EDITABLE_INDEX ||
      endIndex < FIRST_EDITABLE_INDEX ||
      startIndex > endIndex ||
      endIndex >= currentLength
    ) {
      return;
    }

    const buildRepeatBlockFromBody = (
      bodyBlocks: EntryBlock[],
    ): EntryBlock[] => {
      if (!Array.isArray(bodyBlocks) || bodyBlocks.length === 0) {
        return bodyBlocks;
      }

      const loopCount = slot.loopCount as number | null;
      if (typeof loopCount !== 'number' || loopCount <= 1) {
        // loopCount가 없거나 1 이하이면 감싸지 않고 그대로 둔다
        return bodyBlocks;
      }

      const rep = createRepeatBlock(loopCount, bodyBlocks);
      return [rep];
    };

    const newScript = wrapBlocksRange(
      mainScript2,
      startIndex,
      endIndex,
      (body) => buildRepeatBlockFromBody(body),
    );

    const newScripts = [...scripts];
    newScripts[0] = newScript;

    const updatedProjectData = applyScripts(
      projectData,
      newScripts,
      sourceType,
    );
    return updatedProjectData;
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

  private resolveRangeFromSlot(
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

  private selectPrimarySlot(intent: IntentItemT): SlotT | null {
    const slots = intent.slots ?? [];
    if (!slots.length) return null;

    // 1) limitationType 이 있는 slot이 최우선 (UNSUPPORTED_ACTION, UNSUPPORTED_COMBINATION 등)
    const limitationSlot = slots.find((s) => s.limitationType != null);
    if (limitationSlot) return limitationSlot;

    // 2) needsClarification = true 인 slot
    const clarifySlot = slots.find((s) => s.needsClarification === true);
    if (clarifySlot) return clarifySlot;

    // 3) 코드 작업 slot (taskType 이 있는 것들) 중 첫 번째
    const taskSlot = slots.find((s) => s.taskType != null);
    if (taskSlot) return taskSlot;

    // 4) 질문 slot (questionType 이 있는 것들) 중 첫 번째
    const questionSlot = slots.find((s) => s.questionType != null);
    if (questionSlot) return questionSlot;

    // 5) 그래도 없으면 그냥 slots[0]
    return slots[0] ?? null;
  }

  async buildReply(params: {
    utterance: string;
    intentItem: IntentItemT;
    codeSummary?: string;
    missionContext?: any;
  }): Promise<string> {
    const { utterance, intentItem, codeSummary, missionContext } = params;

    const normalized = normalizeIntentForMultiTask(intentItem, utterance);
    const primarySlot = this.selectPrimarySlot(normalized);

    if (!primarySlot) {
      // slot 자체가 없으면 → globalIntent 기준으로 처리
      switch (normalized.globalIntent) {
        case 'TASK_CODE':
          // 코드 작업 의도인데 slot이 비어 있으면, 어떤 동작인지 추가 설명 요청
          return '어떤 동작을 만들거나 어떤 점이 궁금한지 조금만 더 자세히 말해줄 수 있을까요?';

        case 'QUESTION':
          // 질문인데 slot이 없으면, 그래도 LLM에게 넘겨서 자연어로 답변
          return this.conversationLLM({
            utterance,
            intentItem: normalized,
            codeSummary,
            missionContext,
          });

        default:
          // SMALL_TALK / OTHER / UNKNOWN → 그냥 대화 LLM에 맡기기
          return this.conversationLLM({
            utterance,
            intentItem: normalized,
            codeSummary,
            missionContext,
          });
      }
    }

    // 2) limitationType 최우선
    if (primarySlot.limitationType) {
      return this.buildLimitationMessage(primarySlot, utterance);
    }

    // 3) 모호한 경우 (needsClarification = true)
    if (primarySlot.needsClarification) {
      return this.buildClarificationMessage(primarySlot);
    }

    // 4) 제한/모호 없음 → globalIntent 기준 분기
    switch (normalized.globalIntent) {
      case 'TASK_CODE':
        // 코드 작업 요청인데, 제한/모호 없음 → 서버 템플릿으로 2문장 생성
        return this.buildTaskCodeDoneMessage(primarySlot);

      case 'QUESTION':
        switch (normalized.slots[0].questionType) {
          case 'WHY_WRONG_GENERAL':
            return this.conversationLLM({
              utterance,
              intentItem: normalized,
              useContext: false,
            });
          default:
            // 이 때만 LLM 사용 + codeSummary/missionContext 활용
            return this.conversationLLM({
              utterance,
              intentItem: normalized,
              codeSummary,
              missionContext,
              useContext: true,
            });
        }

      default:
        // SMALL_TALK / OTHER / UNKNOWN → LLM or 간단 멘트
        return this.conversationLLM({
          utterance,
          intentItem: normalized,
          codeSummary,
          missionContext,
        });
    }
  }

  // limitationType
  private buildLimitationMessage(slot: any, utterance: string): string {
    const raw = (slot.rawSpan as string | null)?.trim() || utterance.trim();
    const type = slot.limitationType as string;

    switch (type) {
      case 'UNSUPPORTED_ACTION': {
        return `
          "${raw}" 같은 동작은 현재 미션에서는 지원되지 않아요.
          말해 코딩에서는 '앞으로 가기', '왼쪽으로 돌기', '오른쪽으로 돌기'처럼 미리 정해진 행동들을 조합해서,
          미션 목표를 달성하는 절차를 자연어로 순서대로 설계하는 연습을 하고 있어요.
          위 3가지 행동 중에서 요청해 주시겠어요?
        `
          .trim()
          .replace(/\s+/g, ' ');
      }

      case 'UNSUPPORTED_COMBINATION':
        return `
          지금 설명해 준 방식은 블록 조합 규칙에서는 바로 만들기 어려운 구조예요.
          비슷한 동작을 두 단계로 나누어 설계해본다면 어떤 순서로 하면 좋을까요?
        `
          .trim()
          .replace(/\s+/g, ' ');

      default:
        return `
          요청하신 내용을 지금 도구나 규칙으로는 그대로 만들기 어려운 부분이 있어요.
          가능한 범위 안에서 어떻게 바꾸면 좋을지, 다시 한 번 원하는 모습을 말해줄 수 있을까요?
        `
          .trim()
          .replace(/\s+/g, ' ');
    }
  }

  // ambiguityType / needsClarification
  private buildClarificationMessage(slot: any): string {
    const type = slot.ambiguityType as string | null;
    const action = slot.action as string | null;
    const actionMap: Record<string, string> = {
      move_forward: '앞으로 가기',
      turn_left: '왼쪽으로 돌기',
      turn_right: '오른쪽으로 돌기',
    };

    switch (type) {
      case 'RANGE_SCOPE_VAGUE':
        return `
          지금 말해준 부분이 코드에서 정확히 어디부터 어디까지를 가리키는지 조금 애매해요.
          앞에서 몇 번째 줄부터 몇 번째 줄까지를 바꾸고 싶은지 말해줄 수 있을까요?
        `
          .trim()
          .replace(/\s+/g, ' ');

      case 'REPEAT_COUNT_MISSING':
        return `
          반복문으로 바꾸라는 건 잘 알겠는데, 몇 번 반복할지는 아직 정해지지 않았어요.
          이 동작을 정확히 몇 번 정도 반복하면 좋을까요? 예를 들면 2번, 3번처럼요?
        `
          .trim()
          .replace(/\s+/g, ' ');

      case 'COUNT_OR_LOOP_AMBIGUOUS':
        return `
          여기에서 말한 숫자가 한 번에 몇 칸 가는지인지, 이 동작을 몇 번 반복하는지인지 조금 헷갈려요.
          이 숫자는 한 번 움직일 때의 칸 수를 말하는 건가요, 아니면 같은 동작을 여러 번 반복하는 횟수를 말하는 건가요?
        `
          .trim()
          .replace(/\s+/g, ' ');

      case 'LOOP_SCOPE_VAGUE':
        return `
          말씀해 주신 동작들 전체를 반복하라는 건지, 일부만 반복하라는 건지 명확하지 않아요.
          일부만 반복하고 싶은가요, 아니면 지금 말한 동작 전체를 같이 반복하고 싶은가요?
          조금만 더 자세히 말씀해 주시거나, 한 번에 하나씩 요청해 주시겠어요?
        `
          .trim()
          .replace(/\s+/g, ' ');

      case 'DIRECTION_VAGUE':
        return `
          어느 방향으로 움직여야 하는지 조금 더 구체적으로 알 수 있으면 좋겠어요.
          왼쪽/오른쪽/앞 중에서 어떤 쪽으로 움직이면 좋을까요? 그리고 몇 칸 정도 가면 좋을지도 같이 말해줄 수 있을까요?
        `
          .trim()
          .replace(/\s+/g, ' ');

      case 'TARGET_BLOCK_VAGUE':
        return `
          바꾸고 싶은 대상이 명확하지 않아요. 조금만 더 정확하게 말씀해 주실래요?
          아니면 현재 절차에서 몇번째 블록인지 정확히 말씀해 주세요!
        `
          .trim()
          .replace(/\s+/g, ' ');

      default:
        return `
          지금 말해준 내용 중에 제가 정확히 어떻게 코드를 바꿔야 할지 애매한 부분이 있어요.
          어떤 블록을 추가하거나 바꾸고 싶은지 한 번만 더 자세히 말해줄 수 있을까요?
        `
          .trim()
          .replace(/\s+/g, ' ');
    }
  }

  // TASK_CODE
  private buildTaskCodeDoneMessage(slot: any): string {
    const taskType = slot.taskType;
    const action = slot.action as string | null;
    const count = (slot.count as number | null) ?? 1;
    const actionMap: Record<string, string> = {
      move_forward: '앞으로 가기',
      turn_left: '왼쪽으로 돌기',
      turn_right: '오른쪽으로 돌기',
    };

    const actionLabel = action ? (actionMap[action] ?? '해당 동작') : '동작';

    let donePart = '요청하신 작업을 코드에 반영해뒀어요.';

    // CREATE
    if (taskType === 'CREATE_CODE') {
      donePart =
        count <= 1
          ? `"${actionLabel}" 절차를 마지막 절차에 추가했어요.`
          : `"${actionLabel}" 절차를 마지막 절차에 ${count}번 이어서 추가했어요.`;
    }

    // EDIT
    else if (taskType === 'EDIT_CODE') {
      donePart =
        count <= 1
          ? `"${actionLabel}" 행동이 한 번만 실행되도록 바꿨어요.`
          : `"${actionLabel}" 행동이 ${count}번 실행되도록 코드가 수정했어요.`;
    }

    // DELETE
    else if (taskType === 'DELETE_CODE') {
      donePart = `"${actionLabel}" 블록 일부를 코드에서 삭제했어요.`;
    }

    // REFACTOR
    else if (taskType === 'REFACTOR_CODE') {
      const actionLabel = action ? (actionMap[action] ?? '동작') : '동작';
      const loopCount = (slot.loopCount as number | null) ?? null;

      if (slot.refactMode === 'MERGE_SAME_ACTIONS') {
        if (loopCount && loopCount > 1) {
          // 같은 동작이 loopCount번 반복 → 하나의 반복으로 합침
          donePart = `"${actionLabel}"가 ${loopCount}번 이어지는 부분을 반복 구조로 정리해서 더 간단하게 만들었어요.`;
        } else {
          // loopCount가 없거나 1인 예외 상황 대비용
          donePart = `"${actionLabel}"가 연달아 이어지는 부분을 반복을 사용해서 더 간단하게 정리했어요.`;
        }
      } else {
        // 그 외 REFACTOR 모드 (예: 기본 정리)
        donePart = `"${actionLabel}" 흐름을 더 깔끔하게 정리해뒀어요.`;
      }
    }

    // 실행 안내 멘트
    const runSentences = [
      '이제 실행해서 어떻게 되는지 살펴보세요!',
      '이제 한 번 실행해 보면서 움직임을 확인해보세요!',
      '이제 코드를 실행해 보며 잘 동작하는지 확인해볼까요?',
      '이제 실행해서 캐릭터가 어떻게 움직이는지 확인해보면 좋아요!',
      '그럼 실행해서 바뀐 동작을 직접 확인해보세요!',
    ];
    const runPart =
      runSentences[Math.floor(Math.random() * runSentences.length)];

    return `${donePart} ${runPart}`;
  }
}
