import { EntryBlock } from '../../utils/entry/blockTypes';

export type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
export type Action = 'move_forward' | 'turn_left' | 'turn_right';

export type CellType = 'EMPTY' | 'WALL' | 'GOAL';

export interface MissionMap {
  width: number;
  height: number;
  grid: CellType[][]; // [row][col]
}

export interface MissionDefinition {
  id: number;
  map: MissionMap;
  start: { row: number; col: number; dir: Direction };
  end: { row: number; col: number };
  maxSteps?: number;
}

export type FailReason =
  | 'NOT_AT_GOAL'
  | 'OUT_OF_BOUND'
  | 'HIT_WALL'
  | 'STEP_LIMIT_EXCEEDED';

export interface MissionFinalState {
  row: number;
  col: number;
  dir: Direction;
  stepCount: number;
}

export interface MissionJudgeResult {
  isSuccess: boolean;
  failReason?: FailReason;
  finalState: MissionFinalState;
}

/* ───── EntryBlock → Action[] 변환 ───── */

function mapBlockTypeToAction(type: string): Action | null {
  switch (type) {
    case 'move_forward':
      return 'move_forward';
    case 'rotate_direction_left':
      return 'turn_left';
    case 'rotate_direction_right':
      return 'turn_right';
    default:
      return null;
  }
}

// repeat_basic: params[0] = numberBlock(n) = { type: 'number', params: [n] }
function parseRepeatCount(block: EntryBlock): number {
  const slot0 = block.params?.[0];
  if (!slot0) return 0;

  if (
    typeof slot0 === 'object' &&
    slot0 !== null &&
    (slot0 as EntryBlock).type === 'number'
  ) {
    const numBlock = slot0 as EntryBlock;
    const raw = numBlock.params?.[0];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  const n = Number(slot0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function evalEntryBlock(block: EntryBlock, out: Action[]) {
  const action = mapBlockTypeToAction(block.type);
  if (action) {
    out.push(action);
    return;
  }

  if (block.type === 'repeat_basic') {
    const count = parseRepeatCount(block);
    if (count <= 0) return;

    const slot0 = block.statements?.[0];
    const body: EntryBlock[] = Array.isArray(slot0) ? slot0 : [];

    for (let i = 0; i < count; i++) {
      for (const child of body) evalEntryBlock(child, out);
    }
    return;
  }

  if (Array.isArray(block.statements)) {
    for (const slot of block.statements) {
      if (Array.isArray(slot)) {
        for (const child of slot) evalEntryBlock(child, out);
      }
    }
  }
}

export function extractActionsFromEntryScript(
  script: EntryBlock[],
  options?: { skipFirstTrigger?: boolean },
): Action[] {
  const out: Action[] = [];
  const start = options?.skipFirstTrigger ? 1 : 0;
  for (let i = start; i < script.length; i++) {
    evalEntryBlock(script[i], out);
  }
  return out;
}

/* ───── Action[] 시뮬레이션 ───── */

function turnLeft(dir: Direction): Direction {
  switch (dir) {
    case 'NORTH':
      return 'WEST';
    case 'WEST':
      return 'SOUTH';
    case 'SOUTH':
      return 'EAST';
    case 'EAST':
      return 'NORTH';
  }
}

function turnRight(dir: Direction): Direction {
  switch (dir) {
    case 'NORTH':
      return 'EAST';
    case 'EAST':
      return 'SOUTH';
    case 'SOUTH':
      return 'WEST';
    case 'WEST':
      return 'NORTH';
  }
}

function moveForward(row: number, col: number, dir: Direction) {
  switch (dir) {
    case 'NORTH':
      return { row: row - 1, col };
    case 'SOUTH':
      return { row: row + 1, col };
    case 'WEST':
      return { row, col: col - 1 };
    case 'EAST':
      return { row, col: col + 1 };
  }
}

export function judgeMissionResult(
  mission: MissionDefinition,
  actions: Action[],
): MissionJudgeResult {
  const { map, start, end, maxSteps } = mission;
  let { row, col, dir } = start;
  let stepCount = 0;

  for (const action of actions) {
    stepCount += 1;

    if (maxSteps != null && stepCount > maxSteps) {
      return {
        isSuccess: false,
        failReason: 'STEP_LIMIT_EXCEEDED',
        finalState: { row, col, dir, stepCount },
      };
    }

    if (action === 'turn_left') {
      dir = turnLeft(dir);
      continue;
    }
    if (action === 'turn_right') {
      dir = turnRight(dir);
      continue;
    }
    if (action === 'move_forward') {
      const next = moveForward(row, col, dir);
      const { row: nr, col: nc } = next;

      if (nr < 0 || nc < 0 || nr >= map.height || nc >= map.width) {
        return {
          isSuccess: false,
          failReason: 'OUT_OF_BOUND',
          finalState: { row, col, dir, stepCount },
        };
      }

      const cell = map.grid[nr][nc];
      if (cell === 'WALL') {
        return {
          isSuccess: false,
          failReason: 'HIT_WALL',
          finalState: { row, col, dir, stepCount },
        };
      }

      row = nr;
      col = nc;
    }
  }

  const isAtGoal = row === end.row && col === end.col;
  const finalState: MissionFinalState = { row, col, dir, stepCount };

  if (!isAtGoal) {
    return {
      isSuccess: false,
      failReason: 'NOT_AT_GOAL',
      finalState,
    };
  }

  return { isSuccess: true, finalState };
}

/* ───── 통합: Entry Script 하나만 받아서 판단 ───── */

export function judgeMissionFromEntryScript(
  mission: MissionDefinition,
  script: EntryBlock[],
): MissionJudgeResult {
  const actions = extractActionsFromEntryScript(script, {
    skipFirstTrigger: true,
  });
  return judgeMissionResult(mission, actions);
}
