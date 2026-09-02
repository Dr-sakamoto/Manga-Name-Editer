import type { ID, Link, Project, Scene, Thread } from './types';

export const EPS = 1e-6;

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ------------------------------------------------------------------ *
 * ツリー操作
 * ------------------------------------------------------------------ */

export function childrenOf(scenes: Scene[], parentId: ID | null): Scene[] {
  return scenes.filter((s) => s.parentId === parentId);
}

export function isLeaf(scenes: Scene[], id: ID): boolean {
  return !scenes.some((s) => s.parentId === id);
}

export function sceneById(scenes: Scene[], id: ID | null): Scene | undefined {
  if (!id) return undefined;
  return scenes.find((s) => s.id === id);
}

/** 自分自身と全子孫のID */
export function subtreeIds(scenes: Scene[], id: ID): ID[] {
  const out: ID[] = [id];
  for (const child of childrenOf(scenes, id)) out.push(...subtreeIds(scenes, child.id));
  return out;
}

export function isAncestor(scenes: Scene[], ancestorId: ID, nodeId: ID): boolean {
  let cur = sceneById(scenes, nodeId);
  while (cur && cur.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = sceneById(scenes, cur.parentId);
  }
  return false;
}

export function depthOf(scenes: Scene[], id: ID): number {
  let d = 0;
  let cur = sceneById(scenes, id);
  while (cur && cur.parentId) {
    d += 1;
    cur = sceneById(scenes, cur.parentId);
  }
  return d;
}

/* ------------------------------------------------------------------ *
 * ページ配置の計算
 * ------------------------------------------------------------------ */

export interface Placement {
  sceneId: ID;
  /** ネーム先頭からの累積占有率(%) */
  startPct: number;
  endPct: number;
  /** 実効占有率(%)。グループは子の合計 */
  lengthPct: number;
  leaf: boolean;
  depth: number;
  /** 表示順（DFSの通し番号） */
  order: number;
  /** 1始まりの開始ページ */
  startPage: number;
  /** 1始まりの終了ページ（このシーンが最後に載るページ） */
  endPage: number;
  /** 開始ページ内での開始位置(0-100) */
  startOffset: number;
}

export interface Layout {
  placements: Placement[];
  byId: Map<ID, Placement>;
  /** 使用済み占有率の合計(%) */
  usedPct: number;
  /** 総ページ分の占有率(%) */
  capacityPct: number;
  /** 残り(%)。マイナスなら超過 */
  remainingPct: number;
  /** 実際に必要なページ数（切り上げ） */
  neededPages: number;
}

export function pageOf(pct: number): number {
  return Math.floor(pct / 100 + EPS) + 1;
}

export function computeLayout(project: Project): Layout {
  const { scenes, totalPages } = project;
  const placements: Placement[] = [];
  let cursor = 0;
  let order = 0;

  const walk = (parentId: ID | null, depth: number) => {
    for (const scene of childrenOf(scenes, parentId)) {
      const start = cursor;
      const myOrder = order++;
      const kids = childrenOf(scenes, scene.id);
      if (kids.length === 0) {
        cursor += Math.max(0, scene.ratio);
      } else {
        walk(scene.id, depth + 1);
      }
      const end = cursor;
      placements.push({
        sceneId: scene.id,
        startPct: round2(start),
        endPct: round2(end),
        lengthPct: round2(end - start),
        leaf: kids.length === 0,
        depth,
        order: myOrder,
        startPage: pageOf(start),
        endPage: end - start > EPS ? pageOf(Math.max(start, end - EPS)) : pageOf(start),
        startOffset: round2(start % 100),
      });
    }
  };
  walk(null, 0);
  placements.sort((a, b) => a.order - b.order);

  const byId = new Map(placements.map((p) => [p.sceneId, p]));
  const usedPct = round2(cursor);
  const capacityPct = totalPages * 100;
  return {
    placements,
    byId,
    usedPct,
    capacityPct,
    remainingPct: round2(capacityPct - usedPct),
    neededPages: Math.ceil(usedPct / 100 - EPS),
  };
}

/** グループシーンの実効占有率（子の合計）。葉なら ratio そのもの */
export function effectiveRatio(scenes: Scene[], id: ID): number {
  const kids = childrenOf(scenes, id);
  if (kids.length === 0) return sceneById(scenes, id)?.ratio ?? 0;
  return round2(kids.reduce((sum, k) => sum + effectiveRatio(scenes, k.id), 0));
}

/* ------------------------------------------------------------------ *
 * ページ単位のスライス（ページマップ用）
 * ------------------------------------------------------------------ */

export interface PageSlice {
  sceneId: ID;
  /** そのページ内での開始位置(0-100) */
  from: number;
  /** そのページ内での終了位置(0-100) */
  to: number;
  /** ページを跨いでいるシーンか */
  continued: boolean;
  /** このページでシーンが始まるか（false なら前ページからの続き） */
  startsHere: boolean;
  /** このページでシーンが終わるか */
  endsHere: boolean;
}

export interface PageInfo {
  page: number;
  slices: PageSlice[];
  /** そのページの埋まり具合(0-100) */
  filled: number;
  /** 総ページ数を超えたページか */
  overflow: boolean;
}

export function computePages(project: Project, layout: Layout): PageInfo[] {
  const pageCount = Math.max(project.totalPages, layout.neededPages);
  const pages: PageInfo[] = [];
  const leaves = layout.placements.filter((p) => p.leaf && p.lengthPct > EPS);
  for (let page = 1; page <= pageCount; page++) {
    const pStart = (page - 1) * 100;
    const pEnd = page * 100;
    const slices: PageSlice[] = [];
    for (const p of leaves) {
      if (p.endPct <= pStart + EPS || p.startPct >= pEnd - EPS) continue;
      const from = Math.max(p.startPct, pStart) - pStart;
      const to = Math.min(p.endPct, pEnd) - pStart;
      slices.push({
        sceneId: p.sceneId,
        from: round2(from),
        to: round2(to),
        continued: p.startPct < pStart - EPS || p.endPct > pEnd + EPS,
        startsHere: p.startPct >= pStart - EPS,
        endsHere: p.endPct <= pEnd + EPS,
      });
    }
    const filled = round2(slices.reduce((s, x) => s + (x.to - x.from), 0));
    pages.push({ page, slices, filled, overflow: page > project.totalPages });
  }
  return pages;
}

/** 見開き（2ページ組）に分ける。singleFirstPage なら1ページ目を単独扱い */
export function toSpreads(pages: PageInfo[], singleFirstPage: boolean): PageInfo[][] {
  const spreads: PageInfo[][] = [];
  let i = 0;
  if (singleFirstPage && pages.length > 0) {
    spreads.push([pages[0]]);
    i = 1;
  }
  for (; i < pages.length; i += 2) {
    spreads.push(pages.slice(i, i + 2));
  }
  return spreads;
}

/* ------------------------------------------------------------------ *
 * 並べ替え（パズル）
 * ------------------------------------------------------------------ */

export type DropPosition = 'before' | 'after' | 'inside';

/**
 * シーンを移動する。配列内の出現順がそのまま表示順になるため、
 * 対象を取り除いてから挿入位置へ差し込む。
 * 自分自身や子孫の内側へは移動できない。
 */
export function moveScene(
  scenes: Scene[],
  dragId: ID,
  targetId: ID | null,
  position: DropPosition,
): Scene[] {
  if (dragId === targetId) return scenes;
  const dragged = sceneById(scenes, dragId);
  if (!dragged) return scenes;
  if (targetId && (isAncestor(scenes, dragId, targetId) || dragId === targetId)) return scenes;

  const moving = new Set(subtreeIds(scenes, dragId));
  const rest = scenes.filter((s) => !moving.has(s.id));
  const movedNodes = scenes.filter((s) => moving.has(s.id));

  let newParentId: ID | null;
  let insertIndex: number;

  if (targetId === null) {
    newParentId = null;
    insertIndex = rest.length;
  } else {
    const targetIdx = rest.findIndex((s) => s.id === targetId);
    if (targetIdx < 0) return scenes;
    const target = rest[targetIdx];
    if (position === 'inside') {
      newParentId = target.id;
      // 対象の子の最後尾へ
      const kids = rest.filter((s) => s.parentId === target.id);
      const lastKid = kids[kids.length - 1];
      insertIndex = lastKid
        ? rest.findIndex((s) => s.id === lastKid.id) + 1
        : targetIdx + 1;
    } else {
      newParentId = target.parentId;
      insertIndex = position === 'before' ? targetIdx : targetIdx + 1;
    }
  }

  const updated = movedNodes.map((s) => (s.id === dragId ? { ...s, parentId: newParentId } : s));
  const next = [...rest];
  next.splice(insertIndex, 0, ...updated);
  return next;
}

/** 表示順（DFS）で1つ前／後ろのシーンと入れ替える。キーボード操作用 */
export function nudgeScene(scenes: Scene[], id: ID, dir: -1 | 1): Scene[] {
  const siblings = childrenOf(scenes, sceneById(scenes, id)?.parentId ?? null);
  const idx = siblings.findIndex((s) => s.id === id);
  if (idx < 0) return scenes;
  const swapWith = siblings[idx + dir];
  if (!swapWith) return scenes;
  return moveScene(scenes, id, swapWith.id, dir === -1 ? 'before' : 'after');
}

/** 階層を1つ下げる（直前の兄弟の子にする） */
export function indentScene(scenes: Scene[], id: ID): Scene[] {
  const scene = sceneById(scenes, id);
  if (!scene) return scenes;
  const siblings = childrenOf(scenes, scene.parentId);
  const idx = siblings.findIndex((s) => s.id === id);
  if (idx <= 0) return scenes;
  return moveScene(scenes, id, siblings[idx - 1].id, 'inside');
}

/** 階層を1つ上げる（親の次の兄弟にする） */
export function outdentScene(scenes: Scene[], id: ID): Scene[] {
  const scene = sceneById(scenes, id);
  if (!scene || !scene.parentId) return scenes;
  return moveScene(scenes, id, scene.parentId, 'after');
}

/* ------------------------------------------------------------------ *
 * 分割（具体化）
 * ------------------------------------------------------------------ */

export interface SplitPart {
  title: string;
  ratio: number;
}

/**
 * シーンを子シーンに分割して具体化する。
 * 例: 「敵を倒す:200%」→「引き金をひく:50%」「構える:50%」「撃つ:100%」
 * 親はグループになり、ratio は分割前の目標値として残る。
 */
export function splitScene(scenes: Scene[], id: ID, parts: SplitPart[]): Scene[] {
  const parent = sceneById(scenes, id);
  if (!parent || parts.length === 0) return scenes;
  const existingKids = childrenOf(scenes, id);
  const lastKid = existingKids[existingKids.length - 1];
  const anchorIdx = lastKid
    ? scenes.findIndex((s) => s.id === lastKid.id)
    : scenes.findIndex((s) => s.id === id);
  const newScenes: Scene[] = parts.map((p) => ({
    id: uid('sc'),
    parentId: id,
    title: p.title,
    ratio: p.ratio,
    event: '',
    note: '',
    kind: parent.kind,
    collapsed: false,
  }));
  const next = [...scenes];
  next.splice(anchorIdx + 1, 0, ...newScenes);
  return next;
}

/** シーンと子孫を削除。関連リンクも呼び出し側で消すこと */
export function removeScene(scenes: Scene[], id: ID): Scene[] {
  const gone = new Set(subtreeIds(scenes, id));
  return scenes.filter((s) => !gone.has(s.id));
}

/* ------------------------------------------------------------------ *
 * フリ・オチのネットワーク解析
 * ------------------------------------------------------------------ */

export interface LinkPoint {
  link: Link;
  scene: Scene;
  placement: Placement;
}

export type ThreadStatus = 'unlinked' | 'open' | 'resolved' | 'broken';

export interface ThreadAnalysis {
  thread: Thread;
  points: LinkPoint[];
  /** フリが立った位置(%) */
  openPct: number | null;
  /** 回収された位置(%) */
  resolvePct: number | null;
  status: ThreadStatus;
  /** フリからオチまでの引っ張り幅(%) */
  spanPct: number;
  issues: string[];
}

const ROLE_ORDER: Record<string, number> = { raise: 0, reinforce: 1, twist: 2, resolve: 3 };

export function analyzeThreads(project: Project, layout: Layout): ThreadAnalysis[] {
  const sceneMap = new Map(project.scenes.map((s) => [s.id, s]));
  return project.threads.map((thread) => {
    const points: LinkPoint[] = project.links
      .filter((l) => l.threadId === thread.id)
      .map((l) => {
        const scene = sceneMap.get(l.sceneId);
        const placement = layout.byId.get(l.sceneId);
        if (!scene || !placement) return null;
        return { link: l, scene, placement };
      })
      .filter((x): x is LinkPoint => x !== null)
      .sort(
        (a, b) =>
          a.placement.startPct - b.placement.startPct ||
          a.placement.order - b.placement.order ||
          ROLE_ORDER[a.link.role] - ROLE_ORDER[b.link.role],
      );

    const opener = points.find((p) => p.link.role === 'raise');
    const resolver = points.find((p) => p.link.role === 'resolve');
    const issues: string[] = [];

    let status: ThreadStatus;
    if (points.length === 0) {
      status = 'unlinked';
      issues.push('どのシーンにも繋がっていません');
    } else if (!opener) {
      status = 'broken';
      issues.push('フリ（立てるシーン）がありません');
    } else if (!resolver) {
      status = 'open';
      issues.push('まだ回収されていません');
    } else {
      status = 'resolved';
      if (resolver.placement.startPct < opener.placement.startPct - EPS) {
        issues.push('オチがフリより前にあります');
      }
    }
    const openPct = opener ? opener.placement.startPct : points[0]?.placement.startPct ?? null;
    const resolvePct = resolver ? resolver.placement.endPct : null;
    return {
      thread,
      points,
      openPct,
      resolvePct,
      status,
      spanPct:
        openPct !== null && resolvePct !== null ? round2(Math.max(0, resolvePct - openPct)) : 0,
      issues,
    };
  });
}

/**
 * 「回収と同時に新しい予測が生まれる」派生関係。
 * 同じシーンで resolve（または twist）と raise が同居していれば、
 * 前者から後者への派生とみなしてネットワークの枝を作る。
 */
export interface Derivation {
  sceneId: ID;
  fromThreadId: ID;
  toThreadId: ID;
  viaRole: 'resolve' | 'twist';
}

export function deriveThreadChains(project: Project): Derivation[] {
  const bySceneId = new Map<ID, Link[]>();
  for (const l of project.links) {
    const arr = bySceneId.get(l.sceneId) ?? [];
    arr.push(l);
    bySceneId.set(l.sceneId, arr);
  }
  const out: Derivation[] = [];
  for (const [sceneId, links] of bySceneId) {
    const closers = links.filter((l) => l.role === 'resolve' || l.role === 'twist');
    const openers = links.filter((l) => l.role === 'raise');
    for (const c of closers) {
      for (const o of openers) {
        if (c.threadId === o.threadId) continue;
        out.push({
          sceneId,
          fromThreadId: c.threadId,
          toThreadId: o.threadId,
          viaRole: c.role as 'resolve' | 'twist',
        });
      }
    }
  }
  return out;
}

/**
 * ページごとの「読者が同時に抱えている予測の数」＝認知負荷。
 * 多すぎれば散らかり、ゼロが続けば引きが弱い。
 */
export interface LoadPoint {
  page: number;
  open: number;
  openThreadIds: ID[];
}

export function computeReaderLoad(
  analyses: ThreadAnalysis[],
  pageCount: number,
): LoadPoint[] {
  const out: LoadPoint[] = [];
  for (let page = 1; page <= pageCount; page++) {
    const pStart = (page - 1) * 100;
    const pEnd = page * 100;
    const ids = analyses
      .filter((a) => {
        if (a.openPct === null) return false;
        if (a.openPct >= pEnd - EPS) return false;
        if (a.resolvePct !== null && a.resolvePct <= pStart + EPS) return false;
        return true;
      })
      .map((a) => a.thread.id);
    out.push({ page, open: ids.length, openThreadIds: ids });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 警告
 * ------------------------------------------------------------------ */

export interface Warning {
  level: 'error' | 'warn' | 'info';
  message: string;
  sceneId?: ID;
  threadId?: ID;
}

export function collectWarnings(
  project: Project,
  layout: Layout,
  analyses: ThreadAnalysis[],
): Warning[] {
  const out: Warning[] = [];

  if (layout.remainingPct < -EPS) {
    out.push({
      level: 'error',
      message: `総ページを ${fmtPages(-layout.remainingPct)} 超過しています（${layout.neededPages}ページ必要）`,
    });
  } else if (layout.remainingPct > EPS) {
    out.push({
      level: 'info',
      message: `残り ${fmtPages(layout.remainingPct)} 空いています`,
    });
  }

  for (const scene of project.scenes) {
    const kids = childrenOf(project.scenes, scene.id);
    if (kids.length === 0) continue;
    const sum = effectiveRatio(project.scenes, scene.id);
    const diff = round2(sum - scene.ratio);
    if (Math.abs(diff) > 0.01) {
      out.push({
        level: 'warn',
        message: `「${scene.title}」の分割合計が ${sum}%（分割前の想定 ${scene.ratio}% との差 ${diff > 0 ? '+' : ''}${diff}%）`,
        sceneId: scene.id,
      });
    }
  }

  for (const a of analyses) {
    for (const issue of a.issues) {
      out.push({
        level: a.status === 'broken' || issue.includes('前にあります') ? 'error' : 'warn',
        message: `「${a.thread.label}」：${issue}`,
        threadId: a.thread.id,
      });
    }
  }
  return out;
}

export function fmtPages(pct: number): string {
  const pages = pct / 100;
  if (Math.abs(pages - Math.round(pages)) < 0.001) return `${Math.round(pages)}ページ`;
  return `${round2(pages)}ページ`;
}

export function fmtPagePos(pct: number): string {
  const page = pageOf(pct);
  const offset = Math.round(pct % 100);
  if (offset === 0) return `P${page} 頭`;
  if (offset < 34) return `P${page} 上`;
  if (offset < 67) return `P${page} 中`;
  return `P${page} 下`;
}

export function pruneLinks(project: Project): Link[] {
  const sceneIds = new Set(project.scenes.map((s) => s.id));
  const threadIds = new Set(project.threads.map((t) => t.id));
  return project.links.filter((l) => sceneIds.has(l.sceneId) && threadIds.has(l.threadId));
}

export function threadsOfScene(project: Project, sceneId: ID): { link: Link; thread: Thread }[] {
  const map = new Map(project.threads.map((t) => [t.id, t]));
  return project.links
    .filter((l) => l.sceneId === sceneId)
    .map((l) => ({ link: l, thread: map.get(l.threadId) }))
    .filter((x): x is { link: Link; thread: Thread } => !!x.thread);
}
