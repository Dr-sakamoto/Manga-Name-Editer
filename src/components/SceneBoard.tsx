import { useMemo, useState } from 'react';
import type { Api } from '../lib/api';
import type { DropPosition } from '../lib/layout';
import { childrenOf, effectiveRatio, fmtPagePos, isAncestor, round2 } from '../lib/layout';
import { kindMeta, type ID, type Scene } from '../lib/types';
import { SplitDialog } from './SplitDialog';

interface Row {
  scene: Scene;
  depth: number;
  hasKids: boolean;
}

/** 折りたたみを考慮した表示順の行を作る */
function visibleRows(scenes: Scene[]): Row[] {
  const out: Row[] = [];
  const walk = (parentId: ID | null, depth: number) => {
    for (const scene of childrenOf(scenes, parentId)) {
      const kids = childrenOf(scenes, scene.id);
      out.push({ scene, depth, hasKids: kids.length > 0 });
      if (kids.length > 0 && !scene.collapsed) walk(scene.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function SceneBoard({ api }: { api: Api }) {
  const { project, layout } = api;
  const [dragId, setDragId] = useState<ID | null>(null);
  const [dropAt, setDropAt] = useState<{ id: ID | 'tail'; pos: DropPosition } | null>(null);
  const [splitTarget, setSplitTarget] = useState<Scene | null>(null);

  const rows = useMemo(() => visibleRows(project.scenes), [project.scenes]);

  const handleDragOver = (e: React.DragEvent, id: ID) => {
    if (!dragId || dragId === id) return;
    if (isAncestor(project.scenes, dragId, id)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const r = (e.clientY - rect.top) / rect.height;
    const pos: DropPosition = r < 0.3 ? 'before' : r > 0.7 ? 'after' : 'inside';
    setDropAt({ id, pos });
  };

  const handleDrop = (e: React.DragEvent, id: ID) => {
    e.preventDefault();
    if (dragId && dropAt && dropAt.id === id) api.move(dragId, id, dropAt.pos);
    setDragId(null);
    setDropAt(null);
  };

  return (
    <div>
      <div className="board-toolbar">
        <button className="primary" onClick={() => api.addScene({ title: '' })}>
          ＋ シーンを追加
        </button>
        <button
          onClick={() =>
            api.updateProject((p) => ({
              ...p,
              scenes: p.scenes.map((s) => ({ ...s, collapsed: !allCollapsed(p.scenes) })),
            }))
          }
        >
          {allCollapsed(project.scenes) ? '全部ひらく' : '全部たたむ'}
        </button>
        <button
          title="意図的に空けておくページを挿入する（選んでいるシーンの下に入ります）"
          onClick={() =>
            api.addScene({
              after: api.selection?.kind === 'scene' ? api.selection.id : null,
              title: '（空き）',
              ratio: 100,
              kind: 'blank',
            })
          }
        >
          空きを挿入
        </button>
        <span className="hint">
          ドラッグで並べ替え（上下＝前後に挿入／真ん中＝そのシーンの中に入れて具体化）・
          <span className="kbd">Alt</span>+<span className="kbd">↑↓</span> 移動 ・
          <span className="kbd">Alt</span>+<span className="kbd">←→</span> 階層
        </span>
      </div>

      {rows.length === 0 && (
        <div className="empty">
          まだシーンがありません。「＋ シーンを追加」で、思いついた場面と占有率（100%＝1ページ）を置いていってください。
        </div>
      )}

      <div className="scene-list">
        {rows.map((row, i) => {
          const p = layout.byId.get(row.scene.id);
          const prevLeaf = [...rows.slice(0, i)].reverse().find((r) => !r.hasKids);
          const prevPage = prevLeaf ? layout.byId.get(prevLeaf.scene.id)?.startPage : undefined;
          const showBreak =
            !row.hasKids && p && prevPage !== undefined && p.startPage > prevPage;
          const eff = round2(effectiveRatio(project.scenes, row.scene.id));
          const mismatch = row.hasKids && Math.abs(eff - row.scene.ratio) > 0.01;
          const selected =
            api.selection?.kind === 'scene' && api.selection.id === row.scene.id;
          const dropCls =
            dropAt?.id === row.scene.id ? ` drop-${dropAt.pos}` : '';
          return (
            <div key={row.scene.id}>
              {showBreak && <div className="page-break-mark">P{p!.startPage}</div>}
              <div
                className={`scene-row${row.hasKids ? ' group' : ''}${selected ? ' selected' : ''}${
                  dragId === row.scene.id ? ' dragging' : ''
                }${dropCls}`}
                style={{
                  marginLeft: row.depth * 18,
                  ['--kind' as string]: kindMeta(row.scene.kind).color,
                }}
                draggable
                tabIndex={0}
                onClick={() => api.selectScene(row.scene.id)}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', row.scene.id);
                  setDragId(row.scene.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDropAt(null);
                }}
                onDragOver={(e) => handleDragOver(e, row.scene.id)}
                onDragLeave={() => setDropAt((d) => (d?.id === row.scene.id ? null : d))}
                onDrop={(e) => handleDrop(e, row.scene.id)}
                onKeyDown={(e) => {
                  if (!e.altKey) return;
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    api.nudge(row.scene.id, -1);
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    api.nudge(row.scene.id, 1);
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    api.indent(row.scene.id);
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    api.outdent(row.scene.id);
                  }
                }}
              >
                <span className="handle" title="ドラッグして移動">
                  ⣿
                </span>
                {row.hasKids ? (
                  <button
                    className="twisty"
                    onClick={(e) => {
                      e.stopPropagation();
                      api.patchScene(row.scene.id, { collapsed: !row.scene.collapsed });
                    }}
                    title={row.scene.collapsed ? 'ひらく' : 'たたむ'}
                  >
                    {row.scene.collapsed ? '▶' : '▼'}
                  </button>
                ) : (
                  <span className="twisty" />
                )}

                <span className="name">
                  <input
                    value={row.scene.title}
                    placeholder="シーン名（例：敵を倒す）"
                    onChange={(e) =>
                      api.patchScene(row.scene.id, { title: e.target.value }, `t${row.scene.id}`)
                    }
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => api.selectScene(row.scene.id)}
                  />
                </span>

                {row.scene.event && (
                  <span className="event-preview" title={row.scene.event}>
                    {row.scene.event}
                  </span>
                )}
                {countLinks(api, row.scene.id) > 0 && (
                  <span className="chip" title="フリ・オチの接続数">
                    ふり{countLinks(api, row.scene.id)}
                  </span>
                )}

                <span className="pos">{p ? fmtPagePos(p.startPct) : ''}</span>

                <span className={`ratio${mismatch ? ' mismatch' : ''}`}>
                  {row.hasKids ? (
                    <span title={`分割前の想定 ${row.scene.ratio}%`}>{eff}%</span>
                  ) : (
                    <input
                      type="number"
                      step={25}
                      min={0}
                      value={row.scene.ratio}
                      onChange={(e) =>
                        api.patchScene(
                          row.scene.id,
                          { ratio: Math.max(0, Number(e.target.value) || 0) },
                          `r${row.scene.id}`,
                        )
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </span>

                <span className="row-actions">
                  <button
                    className="ghost tiny"
                    title="このシーンを分割して具体化する"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSplitTarget(row.scene);
                    }}
                  >
                    分割
                  </button>
                  <button
                    className="ghost tiny"
                    title="下にシーンを追加"
                    onClick={(e) => {
                      e.stopPropagation();
                      api.addScene({ after: row.scene.id });
                    }}
                  >
                    ＋
                  </button>
                  <button
                    className="ghost tiny"
                    title="複製"
                    onClick={(e) => {
                      e.stopPropagation();
                      api.duplicateScene(row.scene.id);
                    }}
                  >
                    ⧉
                  </button>
                  <button
                    className="ghost tiny danger"
                    title="削除"
                    onClick={(e) => {
                      e.stopPropagation();
                      api.deleteScene(row.scene.id);
                    }}
                  >
                    ×
                  </button>
                </span>
              </div>
            </div>
          );
        })}

        <div
          className={`drop-tail${dropAt?.id === 'tail' ? ' over' : ''}`}
          onDragOver={(e) => {
            if (!dragId) return;
            e.preventDefault();
            setDropAt({ id: 'tail', pos: 'after' });
          }}
          onDragLeave={() => setDropAt((d) => (d?.id === 'tail' ? null : d))}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId) api.move(dragId, null, 'after');
            setDragId(null);
            setDropAt(null);
          }}
        >
          いちばん最後へ移動
        </div>
      </div>

      {splitTarget && (
        <SplitDialog
          api={api}
          scene={splitTarget}
          onClose={() => setSplitTarget(null)}
        />
      )}
    </div>
  );
}

function allCollapsed(scenes: Scene[]): boolean {
  const groups = scenes.filter((s) => scenes.some((c) => c.parentId === s.id));
  return groups.length > 0 && groups.every((s) => s.collapsed);
}

function countLinks(api: Api, sceneId: ID): number {
  return api.project.links.filter((l) => l.sceneId === sceneId).length;
}
