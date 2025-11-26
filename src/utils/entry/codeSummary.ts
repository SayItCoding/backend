import type { EntryBlock } from './blockTypes';

type SummaryNode =
  | { type: 'move'; count: number }
  | { type: 'turn'; direction: 'left' | 'right'; count: number }
  | { type: 'repeat'; times: number; body: SummaryNode[] }
  | { type: 'unknown'; rawType: string };

function summarizeThread(blocks: EntryBlock[]): SummaryNode[] {
  const result: SummaryNode[] = [];

  for (const b of blocks) {
    switch (b.type) {
      case 'move_forward': {
        result.push({ type: 'move', count: 1 });
        break;
      }
      case 'rotate_direction_left': {
        result.push({ type: 'turn', direction: 'left', count: 1 });
        break;
      }
      case 'rotate_direction_right': {
        result.push({ type: 'turn', direction: 'right', count: 1 });
        break;
      }
      case 'repeat_basic': {
        // repeat_basic 의 구조:
        // params[0] = numberBlock(n), statements[0] = 반복할 블록 배열
        const times = readRepeatCount(b);
        const bodyBlocks: EntryBlock[] = Array.isArray(b.statements?.[0])
          ? (b.statements[0] as EntryBlock[])
          : [];

        const bodySummary = summarizeThread(bodyBlocks);

        result.push({
          type: 'repeat',
          times: times ?? 1,
          body: bodySummary,
        });
        break;
      }
      default: {
        result.push({ type: 'unknown', rawType: b.type });
        break;
      }
    }
  }

  return mergeSimpleRuns(result);
}

/** repeat_basic 의 반복 횟수 추출 (없으면 null) */
function readRepeatCount(block: EntryBlock): number | null {
  const numBlock = block.params?.[0] as EntryBlock | undefined;
  if (!numBlock) return null;
  if (!Array.isArray(numBlock.params)) return null;
  const raw = numBlock.params[0];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** move/turn 이 연속된 경우 count 를 합쳐서 좀 더 깔끔한 요약으로 */
function mergeSimpleRuns(nodes: SummaryNode[]): SummaryNode[] {
  const merged: SummaryNode[] = [];

  for (const node of nodes) {
    const last = merged[merged.length - 1];

    if (last && node.type === 'move' && last.type === 'move') {
      last.count += node.count;
    } else if (
      last &&
      node.type === 'turn' &&
      last.type === 'turn' &&
      last.direction === node.direction
    ) {
      last.count += node.count;
    } else {
      merged.push({ ...node });
    }
  }

  return merged;
}

function formatSummary(nodes: SummaryNode[], indent = 0): string {
  const pad = '  '.repeat(indent);
  let lines: string[] = [];

  nodes.forEach((node, idx) => {
    const prefix = `${pad}${idx + 1}. `;

    switch (node.type) {
      case 'move':
        lines.push(`${prefix}앞으로 ${node.count}칸 이동`);
        break;
      case 'turn':
        lines.push(
          `${prefix}${node.direction === 'left' ? '왼쪽' : '오른쪽'}으로 ${node.count}번 회전`,
        );
        break;
      case 'repeat':
        lines.push(`${prefix}아래 동작을 ${node.times}번 반복:`);
        lines.push(formatSummary(node.body, indent + 1));
        break;
      case 'unknown':
        lines.push(`${prefix}[알 수 없는 블록 타입: ${node.rawType}]`);
        break;
    }
  });

  return lines.join('\n');
}

// scripts: normalizeScripts(projectData).scripts 같은 구조를 기대
export function buildCodeSummaryFromScripts(scripts: EntryBlock[][]): string {
  const mainThread = scripts?.[0] ?? [];
  if (mainThread.length === 0) {
    return '현재 코드가 비어 있습니다.';
  }

  // 보통 첫 블록이 트리거(when_run_button_click)라고 가정
  const [first, ...rest] = mainThread;

  const hasTrigger = first.type === 'when_run_button_click';
  const triggerLine = hasTrigger
    ? '- 트리거: 실행 버튼을 눌렀을 때 시작\n'
    : '- 트리거: (알 수 없음)\n';

  const steps = summarizeThread(hasTrigger ? rest : mainThread);
  const procedure =
    steps.length > 0 ? formatSummary(steps) : '  (아직 동작 블록이 없습니다)';

  return [triggerLine.trimEnd(), '- 절차:', procedure].join('\n');
}
