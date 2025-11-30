/** script가 문자열이든 배열이든 2차원 배열로 정규화 */
export function normalizeScripts(projectData: any): {
  scripts: any[][];
  sourceType: 'string' | 'array' | 'none';
} {
  if (!projectData?.objects?.[0]) {
    return { scripts: [[]], sourceType: 'none' };
  }

  const script = projectData.objects[0].script;

  // 문자열 형태 ("[[...]]")
  if (typeof script === 'string') {
    try {
      const parsed = JSON.parse(script);
      if (Array.isArray(parsed)) {
        return { scripts: parsed, sourceType: 'string' };
      }
    } catch {
      /* 무시하고 아래로 */
    }
  }

  // 이미 파싱된 배열 형태
  if (Array.isArray(script)) {
    return { scripts: script, sourceType: 'array' };
  }

  // 없으면 비어 있는 스크립트 생성
  return { scripts: [[]], sourceType: 'none' };
}

/** 갱신된 scripts를 projectData에 다시 세팅 */
export function applyScripts(
  projectData: any,
  scripts: any[][],
  sourceType: 'string' | 'array' | 'none',
) {
  if (!projectData?.objects?.[0]) {
    return {
      ...projectData,
      objects: [
        {
          script: sourceType === 'string' ? JSON.stringify(scripts) : scripts,
        },
      ],
    };
  }

  const updatedScript =
    sourceType === 'string' ? JSON.stringify(scripts) : scripts;

  return {
    ...projectData,
    objects: projectData.objects.map((obj: any, index: number) =>
      index === 0 ? { ...obj, script: updatedScript } : obj,
    ),
  };
}

export function insertBlocksAt(
  mainScript: any[],
  index: number,
  blocks: any[],
): any[] {
  const before = mainScript.slice(0, index);
  const after = mainScript.slice(index);
  return [...before, ...blocks, ...after];
}

export function replaceBlocksAt(
  mainScript: any[],
  index: number,
  blocks: any[],
  deleteCount = 1,
): any[] {
  if (index < 0 || index >= mainScript.length) return mainScript;
  const before = mainScript.slice(0, index);
  const after = mainScript.slice(index + deleteCount);
  return [...before, ...blocks, ...after];
}

export function deleteBlocksRange(
  mainScript: any[],
  startIndex: number,
  endIndex: number,
): any[] {
  if (mainScript.length === 0) return mainScript;

  const safeStart = Math.max(0, startIndex);
  const safeEnd = Math.min(mainScript.length - 1, endIndex);

  if (safeStart > safeEnd) {
    return mainScript;
  }

  const before = mainScript.slice(0, safeStart);
  const after = mainScript.slice(safeEnd + 1);

  return [...before, ...after];
}
