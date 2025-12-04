import {
  IntentItemT,
  TaskType,
  QuestionType,
  AmbiguityType,
} from './intent.schema';
import { MissionChat } from '../../mission/entity/mission-chat.entity';
import { MissionChatAnalysis } from '../../mission/entity/mission-chat-analysis.entity';
import { Repository } from 'typeorm';

function extractTaskTypes(slots: IntentItemT['slots']) {
  const set = new Set<TaskType>();
  for (const s of slots) if (s.taskType) set.add(s.taskType);
  return set.size ? Array.from(set) : null;
}

function extractQuestionTypes(slots: IntentItemT['slots']) {
  const set = new Set<QuestionType>();
  for (const s of slots) if (s.questionType) set.add(s.questionType);
  return set.size ? Array.from(set) : null;
}

function extractLoopStats(slots: IntentItemT['slots']) {
  const loopCounts: number[] = [];
  let hasLoopIntent = false;

  for (const s of slots) {
    if (s.loopExplicit || s.loopCount != null) {
      hasLoopIntent = true;
    }
    if (s.loopCount != null) loopCounts.push(s.loopCount);
  }

  if (!loopCounts.length) {
    return { hasLoopIntent, avgLoopCount: null, maxLoopCount: null };
  }

  const sum = loopCounts.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / loopCounts.length);
  const max = Math.max(...loopCounts);
  return { hasLoopIntent, avgLoopCount: avg, maxLoopCount: max };
}

function extractAmbiguity(slots: IntentItemT['slots']) {
  const types = new Set<AmbiguityType>();
  let hasAmbiguity = false;

  for (const s of slots) {
    if (s.needsClarification) hasAmbiguity = true;
    if (s.ambiguityType) types.add(s.ambiguityType);
  }

  return {
    hasAmbiguity,
    ambiguityTypes: types.size ? Array.from(types) : null,
  };
}

export async function saveMissionChatAnalysis(
  chat: MissionChat,
  intent: IntentItemT,
  repo: Repository<MissionChatAnalysis>,
) {
  const { slots, globalIntent, confidence } = intent;

  const taskTypes = extractTaskTypes(slots);
  const questionTypes = extractQuestionTypes(slots);
  const { hasLoopIntent, avgLoopCount, maxLoopCount } = extractLoopStats(slots);
  const { hasAmbiguity, ambiguityTypes } = extractAmbiguity(slots);

  const analysis = repo.create({
    chat,
    chatId: chat.id,
    globalIntent,
    confidence,
    slots,
    slotCount: slots.length,
    hasTaskCode: !!taskTypes,
    hasQuestion: !!questionTypes,
    taskTypes,
    questionTypes,
    hasLoopIntent,
    avgLoopCount,
    maxLoopCount,
    hasAmbiguity,
    ambiguityTypes,
    rawIntent: intent,
  });

  await repo.save(analysis);
}
