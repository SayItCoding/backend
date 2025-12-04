import { SlotT } from 'src/ai/intentclassifier/intent.schema';
import { EntryBlock, genId, withDefaults } from './blockTypes';

function numberBlock(value?: number): EntryBlock {
  return withDefaults({ id: genId('num'), type: 'number', params: [value] });
}

function angleBlock(value?: number): EntryBlock {
  return withDefaults({ id: genId('angle'), type: 'angle', params: [value] });
}

function moveBlock(action: 'move_forward'): EntryBlock {
  return withDefaults({
    id: genId('move'),
    type: action,
    params: [numberBlock()],
  });
}

function turnBlock(action: 'turn_left' | 'turn_right'): EntryBlock {
  const blockType =
    action == 'turn_left' ? 'rotate_direction_left' : 'rotate_direction_right';

  return withDefaults({
    id: genId('turn'),
    type: blockType,
    params: [angleBlock()],
  });
}

function repeatBlock(n: number, inner: EntryBlock[]): EntryBlock {
  return withDefaults({
    id: genId('rep'),
    type: 'repeat_basic',
    params: [numberBlock(n), null],
    statements: [inner], // 첫 번째 슬롯에 본문 블록 배열
  });
}

export function createRepeatBlock(n: number, inner: EntryBlock[]): EntryBlock {
  return repeatBlock(n, inner);
}

/** 기본 트리거 블록 생성 */
export function createTriggerBlock() {
  return {
    id: genId('trig'),
    x: 50,
    y: 30,
    type: 'when_run_button_click',
    params: [null],
    statements: [],
    movable: null,
    deletable: 1,
    emphasized: false,
    readOnly: null,
    copyable: true,
    assemble: true,
    extensions: [],
  };
}

/** 슬롯을 기반으로 “추가할 블록들”을 만든다. (트리거 제외) */
export function buildBlocksFromSlot(slot: SlotT): EntryBlock[] {
  if (!slot.action) return [];

  const action = slot.action;
  const count = Math.max(1, slot.count ?? 1);
  const loop = slot.loopExplicit;
  const loopCount = Math.max(1, slot.loopCount ?? 1);

  switch (action) {
    case 'move_forward': {
      if (loop) {
        const inner = [moveBlock('move_forward')];
        return [repeatBlock(loopCount, inner)];
      }
      const blocks: EntryBlock[] = [];
      for (let i = 0; i < count; i++) {
        blocks.push(moveBlock('move_forward'));
      }
      return blocks;
    }
    case 'turn_left': {
      if (loop) {
        const inner = [turnBlock('turn_left')];
        return [repeatBlock(loopCount, inner)];
      }
      const blocks: EntryBlock[] = [];
      for (let i = 0; i < count; i++) {
        blocks.push(turnBlock('turn_left'));
      }
      return blocks;
    }
    case 'turn_right': {
      if (loop) {
        const inner = [turnBlock('turn_right')];
        return [repeatBlock(loopCount, inner)];
      }
      const blocks: EntryBlock[] = [];
      for (let i = 0; i < count; i++) {
        blocks.push(turnBlock('turn_right'));
      }
      return blocks;
    }
    default:
      return [];
  }
}
