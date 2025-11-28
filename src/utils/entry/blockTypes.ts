export type Slot = {
  action: 'move_forward' | 'turn_left' | 'turn_right' | null;
  count: number | null; // null이면 1
  loopExplicit: boolean | null;
  loopCount: number | null;
  targetScope: string | null;
  rangeAnchor: string | null;
  rangeCount: number | null;
  rangeIndexFrom: number | null;
  rangeIndexTo: number | null;
};

export type EntryBlock = {
  id: string;
  x: number;
  y: number;
  type: string;
  params: any[];
  statements: any[];
  movable: null | boolean;
  deletable: 0 | 1;
  emphasized: boolean;
  readOnly: null | boolean;
  copyable: boolean;
  assemble: boolean;
  extensions: any[];
};

export const genId = (p = 'blk') =>
  `${p}-${Math.random().toString(36).slice(2, 8)}`;

export const withDefaults = (b: Partial<EntryBlock>): EntryBlock => ({
  id: b.id ?? genId(),
  x: b.x ?? 0,
  y: b.y ?? 0,
  type: b.type ?? 'unknown',
  params: Array.isArray(b.params) ? b.params : [],
  statements: Array.isArray(b.statements) ? b.statements : [],
  movable: b.movable ?? null,
  deletable: (b.deletable as 0 | 1) ?? 1,
  emphasized: b.emphasized ?? false,
  readOnly: b.readOnly ?? null,
  copyable: b.copyable ?? true,
  assemble: b.assemble ?? true,
  extensions: Array.isArray(b.extensions) ? b.extensions : [],
});
