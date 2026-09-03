import { describe, expect, it } from 'vitest';
import {
  analyzeThreads,
  childrenOf,
  collectWarnings,
  computeLayout,
  computePages,
  computeReaderLoad,
  deriveThreadChains,
  effectiveRatio,
  indentScene,
  moveScene,
  nudgeScene,
  outdentScene,
  round2,
  splitScene,
  toSpreads,
} from './layout';
import type { Link, Project, Scene, Thread } from './types';

function scene(
  id: string,
  title: string,
  ratio: number,
  parentId: string | null = null,
  extra: Partial<Pick<Scene, 'orientation' | 'locked'>> = {},
): Scene {
  return {
    id,
    parentId,
    title,
    ratio,
    event: '',
    note: '',
    kind: 'scene',
    collapsed: false,
    orientation: extra.orientation ?? 'horizontal',
    locked: extra.locked ?? false,
  };
}

function project(scenes: Scene[], threads: Thread[] = [], links: Link[] = []): Project {
  return {
    id: 'p',
    title: 't',
    totalPages: 4,
    singleFirstPage: false,
    scenes,
    threads,
    links,
    characters: [],
    dialogues: [],
    updatedAt: 0,
  };
}

describe('computeLayout', () => {
  it('占有率を積み上げてページ位置を出す', () => {
    const p = project([scene('a', 'A', 100), scene('b', 'B', 50), scene('c', 'C', 200)]);
    const layout = computeLayout(p);
    expect(layout.byId.get('a')).toMatchObject({ startPct: 0, endPct: 100, startPage: 1 });
    expect(layout.byId.get('b')).toMatchObject({ startPct: 100, endPct: 150, startPage: 2 });
    expect(layout.byId.get('c')).toMatchObject({ startPct: 150, endPct: 350, startPage: 2, endPage: 4 });
    expect(layout.usedPct).toBe(350);
    expect(layout.neededPages).toBe(4);
  });

  it('残ページと超過を出す', () => {
    const p = project([scene('a', 'A', 300)]);
    expect(computeLayout(p).remainingPct).toBe(100);
    const over = computeLayout({ ...p, scenes: [scene('a', 'A', 500)] });
    expect(over.remainingPct).toBe(-100);
    expect(over.neededPages).toBe(5);
  });

  it('グループの占有率は子の合計になる', () => {
    const p = project([
      scene('g', '敵を倒す', 200),
      scene('g1', '構える', 50, 'g'),
      scene('g2', '引き金をひく', 50, 'g'),
      scene('g3', 'うつ', 100, 'g'),
      scene('z', '次', 100),
    ]);
    const layout = computeLayout(p);
    expect(effectiveRatio(p.scenes, 'g')).toBe(200);
    expect(layout.byId.get('g')).toMatchObject({ startPct: 0, endPct: 200, leaf: false });
    expect(layout.byId.get('z')!.startPct).toBe(200);
    expect(layout.usedPct).toBe(300);
  });

  it('分割後に子の合計がずれたら親の実効値もずれる', () => {
    const p = project([
      scene('g', '敵を倒す', 200),
      scene('g1', '構える', 50, 'g'),
      scene('g2', 'うつ', 100, 'g'),
    ]);
    expect(effectiveRatio(p.scenes, 'g')).toBe(150);
    const warnings = collectWarnings(p, computeLayout(p), []);
    expect(warnings.some((w) => w.sceneId === 'g' && w.level === 'warn')).toBe(true);
  });
});

describe('computePages', () => {
  it('ページを跨ぐシーンを分けて載せる', () => {
    const p = project([scene('a', 'A', 150), scene('b', 'B', 50)]);
    const pages = computePages(p, computeLayout(p));
    expect(pages).toHaveLength(4);
    expect(pages[0].slices).toEqual([
      {
        sceneId: 'a',
        from: 0,
        to: 100,
        continued: true,
        startsHere: true,
        endsHere: false,
        columnIndex: 0,
        columnCount: 1,
        widthPct: 100,
      },
    ]);
    expect(pages[1].slices).toEqual([
      {
        sceneId: 'a',
        from: 0,
        to: 50,
        continued: true,
        startsHere: false,
        endsHere: true,
        columnIndex: 0,
        columnCount: 1,
        widthPct: 100,
      },
      {
        sceneId: 'b',
        from: 50,
        to: 100,
        continued: false,
        startsHere: true,
        endsHere: true,
        columnIndex: 0,
        columnCount: 1,
        widthPct: 100,
      },
    ]);
    expect(pages[1].filled).toBe(100);
    expect(pages[2].filled).toBe(0);
  });

  it('総ページを超えたページには overflow が立つ', () => {
    const p = { ...project([scene('a', 'A', 500)]), totalPages: 4 };
    const pages = computePages(p, computeLayout(p));
    expect(pages).toHaveLength(5);
    expect(pages[4].overflow).toBe(true);
  });

  it('見開きは1ページ目を単独にできる', () => {
    const p = project([scene('a', 'A', 400)]);
    const pages = computePages(p, computeLayout(p));
    expect(toSpreads(pages, true).map((s) => s.map((x) => x.page))).toEqual([[1], [2, 3], [4]]);
    expect(toSpreads(pages, false).map((s) => s.map((x) => x.page))).toEqual([[1, 2], [3, 4]]);
  });
});

describe('コマの縦横・ロック', () => {
  it('縦長コマが連続すると同じ行に横並びで入る', () => {
    const p = project([
      scene('a', 'A', 30, null, { orientation: 'vertical' }),
      scene('b', 'B', 60, null, { orientation: 'vertical' }),
      scene('c', 'C', 100),
    ]);
    const layout = computeLayout(p);
    const a = layout.byId.get('a')!;
    const b = layout.byId.get('b')!;
    const cScene = layout.byId.get('c')!;
    // 行の高さは含有率の合計、幅は互いの比率で分け合う
    expect(a).toMatchObject({ startPct: 0, endPct: 90, columnIndex: 0, columnCount: 2, widthPct: round2((100 * 30) / 90) });
    expect(b).toMatchObject({ startPct: 0, endPct: 90, columnIndex: 1, columnCount: 2, widthPct: round2((100 * 60) / 90) });
    // 横長コマは単独の行になり、直前の行の後ろから始まる
    expect(cScene).toMatchObject({ startPct: 90, endPct: 190, columnIndex: 0, columnCount: 1, widthPct: 100 });
    expect(layout.usedPct).toBe(190);
  });

  it('ロックしたコマは縦長でも常に単独の行になる', () => {
    const p = project([
      scene('a', 'A', 30, null, { orientation: 'vertical' }),
      scene('b', 'B', 60, null, { orientation: 'vertical', locked: true }),
      scene('c', 'C', 40, null, { orientation: 'vertical' }),
    ]);
    const layout = computeLayout(p);
    expect(layout.byId.get('a')).toMatchObject({ startPct: 0, endPct: 30, columnCount: 1 });
    expect(layout.byId.get('b')).toMatchObject({ startPct: 30, endPct: 90, columnCount: 1 });
    expect(layout.byId.get('c')).toMatchObject({ startPct: 90, endPct: 130, columnCount: 1 });
  });

  it('未ロックのコマの含有率が変わっても、ロックしたコマ自身の含有率は変わらない', () => {
    const before = project([
      scene('a', 'A', 50, null, { orientation: 'vertical' }),
      scene('b', 'B', 50, null, { orientation: 'vertical', locked: true }),
    ]);
    const after = {
      ...before,
      scenes: before.scenes.map((s) => (s.id === 'a' ? { ...s, ratio: 150 } : s)),
    };
    const lockedBefore = computeLayout(before).byId.get('b')!;
    const lockedAfter = computeLayout(after).byId.get('b')!;
    expect(lockedAfter.lengthPct).toBe(lockedBefore.lengthPct);
    expect(lockedAfter.widthPct).toBe(lockedBefore.widthPct);
  });
});

describe('moveScene', () => {
  const base = () => [scene('a', 'A', 100), scene('b', 'B', 100), scene('c', 'C', 100)];

  it('前後に差し込める', () => {
    expect(moveScene(base(), 'c', 'a', 'before').map((s) => s.id)).toEqual(['c', 'a', 'b']);
    expect(moveScene(base(), 'a', 'c', 'after').map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('中に入れると子になる', () => {
    const next = moveScene(base(), 'c', 'a', 'inside');
    expect(next.find((s) => s.id === 'c')!.parentId).toBe('a');
    expect(childrenOf(next, 'a').map((s) => s.id)).toEqual(['c']);
  });

  it('子ごと動く', () => {
    const scenes = [
      scene('a', 'A', 100),
      scene('a1', 'A1', 50, 'a'),
      scene('a2', 'A2', 50, 'a'),
      scene('b', 'B', 100),
    ];
    const next = moveScene(scenes, 'a', 'b', 'after');
    expect(next.map((s) => s.id)).toEqual(['b', 'a', 'a1', 'a2']);
    expect(childrenOf(next, 'a').map((s) => s.id)).toEqual(['a1', 'a2']);
  });

  it('自分の子孫の中には入れられない', () => {
    const scenes = [scene('a', 'A', 100), scene('a1', 'A1', 50, 'a')];
    expect(moveScene(scenes, 'a', 'a1', 'inside')).toBe(scenes);
    expect(moveScene(scenes, 'a', 'a', 'before')).toBe(scenes);
  });

  it('移動でページ配置が組み替わる', () => {
    const p = project([scene('a', 'A', 100), scene('b', 'B', 200), scene('c', 'C', 100)]);
    const moved = { ...p, scenes: moveScene(p.scenes, 'c', 'a', 'before') };
    const layout = computeLayout(moved);
    expect(layout.byId.get('c')!.startPage).toBe(1);
    expect(layout.byId.get('a')!.startPage).toBe(2);
  });
});

describe('キーボード操作', () => {
  it('入れ替え・階層の上げ下げ', () => {
    const scenes = [scene('a', 'A', 100), scene('b', 'B', 100)];
    expect(nudgeScene(scenes, 'b', -1).map((s) => s.id)).toEqual(['b', 'a']);
    const indented = indentScene(scenes, 'b');
    expect(indented.find((s) => s.id === 'b')!.parentId).toBe('a');
    const outdented = outdentScene(indented, 'b');
    expect(outdented.find((s) => s.id === 'b')!.parentId).toBe(null);
  });
});

describe('splitScene', () => {
  it('具体化した子シーンを作る', () => {
    const scenes = [scene('g', '敵を倒す', 200), scene('z', '次', 100)];
    const next = splitScene(scenes, 'g', [
      { title: '構える', ratio: 50 },
      { title: '引き金をひく', ratio: 50 },
      { title: 'うつ', ratio: 100 },
    ]);
    const kids = childrenOf(next, 'g');
    expect(kids.map((k) => k.title)).toEqual(['構える', '引き金をひく', 'うつ']);
    expect(effectiveRatio(next, 'g')).toBe(200);
    // 親の後ろにあるシーンの順序は保たれる
    expect(next[next.length - 1].id).toBe('z');
    expect(next.find((s) => s.id === 'g')!.ratio).toBe(200);
  });

  it('分割済みのシーンをさらに分割できる', () => {
    let scenes = [scene('g', '敵を倒す', 200)];
    scenes = splitScene(scenes, 'g', [{ title: 'うつ', ratio: 200 }]);
    const kid = childrenOf(scenes, 'g')[0];
    scenes = splitScene(scenes, kid.id, [
      { title: '発砲', ratio: 100 },
      { title: '着弾', ratio: 100 },
    ]);
    expect(childrenOf(scenes, kid.id)).toHaveLength(2);
    expect(effectiveRatio(scenes, 'g')).toBe(200);
  });
});

describe('フリ・オチのネットワーク', () => {
  const scenes = [
    scene('s1', '尾行', 100),
    scene('s2', '助ける', 100),
    scene('s3', '盗む', 100),
  ];
  const threads: Thread[] = [
    { id: 't1', label: '敵では？', kind: 'question', note: '', color: '#000' },
    { id: 't2', label: '隠している', kind: 'question', note: '', color: '#111' },
    { id: 't3', label: '目的は？', kind: 'question', note: '', color: '#222' },
  ];
  const link = (id: string, sceneId: string, threadId: string, role: Link['role']): Link => ({
    id,
    sceneId,
    threadId,
    role,
    note: '',
  });

  it('1シーンが複数の予測を立て、1シーンが複数を回収する', () => {
    const links = [
      link('l1', 's1', 't1', 'raise'),
      link('l2', 's1', 't2', 'raise'),
      link('l3', 's2', 't1', 'resolve'),
      link('l4', 's2', 't2', 'reinforce'),
      link('l5', 's3', 't3', 'raise'),
    ];
    const p = project(scenes, threads, links);
    const analyses = analyzeThreads(p, computeLayout(p));
    const t1 = analyses.find((a) => a.thread.id === 't1')!;
    expect(t1.status).toBe('resolved');
    expect(t1.openPct).toBe(0);
    expect(t1.resolvePct).toBe(200);
    expect(t1.spanPct).toBe(200);
    const t2 = analyses.find((a) => a.thread.id === 't2')!;
    expect(t2.status).toBe('open');
    expect(t2.points.map((pt) => pt.link.role)).toEqual(['raise', 'reinforce']);
  });

  it('回収と同時に立つ予測を派生として繋ぐ', () => {
    const links = [
      link('l1', 's1', 't1', 'raise'),
      link('l3', 's2', 't1', 'resolve'),
      link('l4', 's2', 't3', 'raise'),
    ];
    const chains = deriveThreadChains(project(scenes, threads, links));
    expect(chains).toEqual([
      { sceneId: 's2', fromThreadId: 't1', toThreadId: 't3', viaRole: 'resolve' },
    ]);
  });

  it('オチがフリより前にあれば警告する', () => {
    const links = [link('l1', 's3', 't1', 'raise'), link('l2', 's1', 't1', 'resolve')];
    const p = project(scenes, threads.slice(0, 1), links);
    const analyses = analyzeThreads(p, computeLayout(p));
    expect(analyses[0].issues).toContain('オチがフリより前にあります');
    expect(collectWarnings(p, computeLayout(p), analyses).some((w) => w.level === 'error')).toBe(
      true,
    );
  });

  it('フリのないスレッドは壊れている扱い', () => {
    const links = [link('l1', 's2', 't1', 'resolve')];
    const p = project(scenes, threads.slice(0, 1), links);
    expect(analyzeThreads(p, computeLayout(p))[0].status).toBe('broken');
  });

  it('ページごとに読者が抱えている予測の数を数える', () => {
    const links = [
      link('l1', 's1', 't1', 'raise'),
      link('l2', 's1', 't2', 'raise'),
      link('l3', 's2', 't1', 'resolve'),
      link('l4', 's3', 't3', 'raise'),
    ];
    const p = project(scenes, threads, links);
    const analyses = analyzeThreads(p, computeLayout(p));
    const load = computeReaderLoad(analyses, 3);
    // 回収されるページでは、読者はそのページの途中まで予測を抱えているので open に数える
    expect(load.map((x) => x.open)).toEqual([2, 2, 2]);
    expect(load[2].openThreadIds).toEqual(['t2', 't3']);
  });
});
