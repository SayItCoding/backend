export interface IntentCount {
  key: string;
  count: number;
  ratio: number; // 0 ~ 1
}

export interface StudyInsightSummaryDto {
  period: {
    from: string;
    to: string;
  };

  totalUserMessages: number;

  globalIntentStats: IntentCount[];
  taskTypeStats: IntentCount[];
  questionTypeStats: IntentCount[];

  loopIntentRate: number;
  avgLoopCount: number | null;
  maxLoopCount: number | null;

  ambiguityRate: number;
  topAmbiguityTypes: IntentCount[];

  strengths: string[];
  suggestions: string[];
}
