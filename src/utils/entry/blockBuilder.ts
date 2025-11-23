import { EntryBlock, Slot, genId, withDefaults } from './blockTypes';

function numberBlock(value?: number): EntryBlock {
  return withDefaults({ id: genId('num'), type: 'number', params: [value] });
}

function angleBlock(value?: number): EntryBlock {
  return withDefaults({ id: genId('angle'), type: 'angle', params: [value] });
}

function moveBlock(direction: 'forward'): EntryBlock {
  // steps=1 고정 (원하면 슬롯에 steps 추가해서 확장)
  return withDefaults({
    id: genId('move'),
    type: 'move_forward',
    params: [numberBlock()],
  });
}

function turnBlock(direction: 'left' | 'right'): EntryBlock {
  const blockType =
    direction == 'left' ? 'rotate_direction_left' : 'rotate_direction_right';

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
export function buildBlocksFromSlots(slot: Slot): EntryBlock[] {
  const action = slot.action ?? 'move';
  const count = Math.max(1, slot.count ?? 1);
  const loop = slot.loop_explicit;
  const dirRaw = slot.direction ?? 'forward';
  // move는 모든 방향 허용, turn은 left/right만 허용
  const dirMove = (
    ['forward', 'backward', 'left', 'right'].includes(dirRaw)
      ? dirRaw
      : 'forward'
  ) as any;
  const dirTurn = (dirRaw === 'right' ? 'right' : 'left') as 'left' | 'right';

  switch (action) {
    case 'move': {
      if (loop) {
        const inner = [moveBlock(dirMove)];
        return [repeatBlock(count, inner)];
      }
      const blocks: EntryBlock[] = [];
      for (let i = 0; i < count; i++) {
        blocks.push(moveBlock(dirMove));
      }
      return blocks;
    }
    case 'turn': {
      if (loop) {
        const inner = [turnBlock(dirTurn)];
        return [repeatBlock(count, inner)];
      }
      const blocks: EntryBlock[] = [];
      for (let i = 0; i < count; i++) {
        blocks.push(turnBlock(dirTurn));
      }
      return blocks;
    }
    case 'repeat': {
      // 기본 동작: forward 1칸
      const inner = [moveBlock('forward')];
      return [repeatBlock(count, inner)];
    }
    default: {
      // 안전 기본: move forward
      const inner = [moveBlock('forward')];
      return [repeatBlock(count, inner)];
    }
  }
}
