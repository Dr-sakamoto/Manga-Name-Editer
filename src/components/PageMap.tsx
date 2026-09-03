import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Api } from '../lib/api';
import { fmtPages, toSpreads, type PageSlice } from '../lib/layout';
import { kindMeta, type Dialogue, type ID } from '../lib/types';

/** 同じ行(from/to が同じ)に並ぶスライスをまとめる。行内は列番号順に並んでいる前提 */
function buildRows(slices: PageSlice[]): PageSlice[][] {
  const rows: PageSlice[][] = [];
  for (const slice of slices) {
    const last = rows[rows.length - 1];
    const lastHead = last?.[0];
    const sameRow =
      last &&
      lastHead &&
      slice.columnCount > 1 &&
      lastHead.from === slice.from &&
      lastHead.to === slice.to &&
      last.length < lastHead.columnCount;
    if (sameRow) {
      last.push(slice);
    } else {
      rows.push([slice]);
    }
  }
  return rows;
}

/**
 * 見開き単位のページマップ。ブロックを掴んで別のページへ放り込むと、
 * 順番が組み替わって後ろのシーンが自動で押し出される（パズル的な操作）。
 */
export function PageMap({ api }: { api: Api }) {
  const { project, layout, pages } = api;
  const [dragId, setDragId] = useState<ID | null>(null);
  const [dropHint, setDropHint] = useState<{ sceneId: ID; pos: 'before' | 'after' } | null>(null);
  const [dropPage, setDropPage] = useState<number | null>(null);
  const sceneMap = new Map(project.scenes.map((s) => [s.id, s]));
  const spreads = toSpreads(pages, project.singleFirstPage);

  const endDrag = () => {
    setDragId(null);
    setDropHint(null);
    setDropPage(null);
  };

  /** 空きスペースに落としたときは「そのページの最後のシーンの後ろ」に入れる */
  const dropOnPage = (page: number) => {
    if (!dragId) return;
    const pStart = (page - 1) * 100;
    const pEnd = page * 100;
    const inPage = layout.placements
      .filter((p) => p.leaf && p.sceneId !== dragId && p.startPct < pEnd && p.endPct > pStart)
      .sort((a, b) => a.startPct - b.startPct);
    if (inPage.length > 0) {
      api.move(dragId, inPage[inPage.length - 1].sceneId, 'after');
    } else {
      const before = layout.placements
        .filter((p) => p.leaf && p.sceneId !== dragId && p.startPct < pStart)
        .sort((a, b) => a.startPct - b.startPct);
      if (before.length > 0) api.move(dragId, before[before.length - 1].sceneId, 'after');
      else api.move(dragId, null, 'after');
    }
    endDrag();
  };

  return (
    <div>
      <div className="board-toolbar">
        <span className="hint">
          ブロックをドラッグして別のページへ移すと、後ろのシーンが自動でずれます。
          白い余白は「まだ空いているページ」です。コマ右上のアイコンでロックの切り替え、
          コマを選ぶと吹き出しを配置できます。
        </span>
      </div>

      <div className="spread-grid">
        {spreads.map((spread, i) => (
          <div className="spread" key={i}>
            {/* 右綴じ：右のページが先。表示は右→左の順にする */}
            {[...spread].reverse().map((info) => (
              <div
                key={info.page}
                className={`page${info.overflow ? ' overflow' : ''}${
                  info.slices.length === 0 ? ' empty-page' : ''
                }${dropPage === info.page ? ' drop-target' : ''}`}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setDropPage(info.page);
                }}
                onDragLeave={() => setDropPage((p) => (p === info.page ? null : p))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dropHint) {
                    if (dragId) api.move(dragId, dropHint.sceneId, dropHint.pos);
                    endDrag();
                  } else {
                    dropOnPage(info.page);
                  }
                }}
              >
                {buildRows(info.slices).map((row, ri) => {
                  const rowHeight = row[0].to - row[0].from;
                  return (
                    <div
                      key={`row-${ri}`}
                      className="page-row"
                      style={{ height: `${rowHeight}%` }}
                    >
                      {row.map((slice, si) => {
                        const scene = sceneMap.get(slice.sceneId);
                        if (!scene) return null;
                        const selected =
                          api.selection?.kind === 'scene' && api.selection.id === slice.sceneId;
                        const hinted =
                          dropHint?.sceneId === slice.sceneId ? ` drop-${dropHint.pos}` : '';
                        return (
                          <div
                            key={`${slice.sceneId}-${si}`}
                            className={`page-slice${selected ? ' selected' : ''}${
                              scene.locked ? ' locked' : ''
                            }${hinted}${slice.startsHere ? '' : ' cont-top'}`}
                            style={{
                              width: `${slice.widthPct}%`,
                              background: tint(kindMeta(scene.kind).color),
                              borderLeft: `3px solid ${kindMeta(scene.kind).color}`,
                            }}
                            draggable={!selected}
                            onClick={() => api.selectScene(slice.sceneId)}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', slice.sceneId);
                              setDragId(slice.sceneId);
                            }}
                            onDragEnd={endDrag}
                            onDragOver={(e) => {
                              if (!dragId || dragId === slice.sceneId) return;
                              e.preventDefault();
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const pos =
                                (e.clientY - rect.top) / rect.height < 0.5 ? 'before' : 'after';
                              setDropHint({ sceneId: slice.sceneId, pos });
                              setDropPage(info.page);
                            }}
                            onDragLeave={() =>
                              setDropHint((h) => (h?.sceneId === slice.sceneId ? null : h))
                            }
                            title={`${scene.title || '無題'}（${scene.ratio}%）${
                              scene.locked ? '\nロック中' : ''
                            }${scene.event ? `\n${scene.event}` : ''}`}
                          >
                            <button
                              type="button"
                              className={`slice-lock-btn${scene.locked ? ' locked' : ''}`}
                              draggable={false}
                              title={
                                scene.locked
                                  ? 'ロック中：クリックで解除（他のコマの変更で行が組み替わらない）'
                                  : 'クリックでロック（他のコマの含有率・向きを変えても押しのけられなくなる）'
                              }
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                api.patchScene(slice.sceneId, { locked: !scene.locked });
                              }}
                            >
                              {scene.locked ? '🔒' : '🔓'}
                            </button>
                            <div className="slice-title">
                              {slice.startsHere ? '' : '↳ '}
                              {scene.title || '無題'}
                            </div>
                            {rowHeight >= 18 && (
                              <div className="slice-meta">
                                {slice.continued
                                  ? `${Math.round(rowHeight)}% / ${scene.ratio}%`
                                  : `${Math.round(rowHeight)}%`}
                              </div>
                            )}
                            {selected && slice.startsHere && (
                              <PanelBubbles api={api} sceneId={slice.sceneId} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                <div className="free" />
                <span className="page-no">
                  {info.page}
                  {info.overflow ? ' 超過' : ''}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="graph-legend" style={{ marginTop: 12 }}>
        <span>
          使用 {fmtPages(layout.usedPct)} ／ 総 {project.totalPages}P ／{' '}
          {layout.remainingPct >= 0
            ? `残り ${fmtPages(layout.remainingPct)}`
            : `超過 ${fmtPages(-layout.remainingPct)}`}
        </span>
      </div>
    </div>
  );
}

type DragMode = 'move' | 'resize';
interface DragState {
  id: ID;
  mode: DragMode;
  startX: number;
  startY: number;
  orig: { x: number; y: number; width: number; height: number };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * 選択中のコマの上に重ねる吹き出しレイヤー。ドラッグで移動、
 * 右下の角で大きさを変更、クリックで役・セリフを編集する。
 */
function PanelBubbles({ api, sceneId }: { api: Api; sceneId: ID }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<ID | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dialogues = api.project.dialogues.filter((d) => d.sceneId === sceneId);
  const charMap = new Map(api.project.characters.map((c) => [c.id, c]));

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;
      if (drag.mode === 'move') {
        api.patchDialogue(
          drag.id,
          {
            x: clamp(drag.orig.x + dxPct, 0, 100 - drag.orig.width),
            y: clamp(drag.orig.y + dyPct, 0, 100 - drag.orig.height),
          },
          `dlpos${drag.id}`,
        );
      } else {
        api.patchDialogue(
          drag.id,
          {
            width: clamp(drag.orig.width + dxPct, 10, 100 - drag.orig.x),
            height: clamp(drag.orig.height + dyPct, 10, 100 - drag.orig.y),
          },
          `dlsize${drag.id}`,
        );
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, api]);

  const startDrag = (d: Dialogue, mode: DragMode, e: ReactPointerEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setDrag({
      id: d.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: d.x, y: d.y, width: d.width, height: d.height },
    });
  };

  return (
    <div
      className="bubble-layer"
      ref={layerRef}
      draggable={false}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {dialogues.map((d) => {
        const ch = d.characterId ? charMap.get(d.characterId) : undefined;
        const editing = editingId === d.id;
        return (
          <div
            key={d.id}
            className={`bubble${editing ? ' editing' : ''}`}
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: `${d.width}%`,
              height: `${d.height}%`,
              borderColor: ch?.color ?? 'var(--line)',
            }}
            onPointerDown={(e) => startDrag(d, 'move', e)}
            onClick={(e) => {
              e.stopPropagation();
              setEditingId(d.id);
            }}
          >
            {editing ? (
              <div
                className="bubble-edit"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <select
                  value={d.characterId ?? ''}
                  onChange={(e) =>
                    api.patchDialogue(d.id, { characterId: e.target.value || null })
                  }
                >
                  <option value="">（役なし）</option>
                  {api.project.characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || '無名'}
                    </option>
                  ))}
                </select>
                <textarea
                  className="vertical-text"
                  autoFocus
                  value={d.text}
                  placeholder="セリフ"
                  onChange={(e) => api.patchDialogue(d.id, { text: e.target.value }, `dlbt${d.id}`)}
                />
                <div className="bubble-edit-actions">
                  <button
                    className="ghost tiny danger"
                    onClick={() => {
                      api.deleteDialogue(d.id);
                      setEditingId(null);
                    }}
                  >
                    削除
                  </button>
                  <button className="tiny" onClick={() => setEditingId(null)}>
                    閉じる
                  </button>
                </div>
              </div>
            ) : (
              <div className="vertical-text bubble-text">{d.text || 'セリフ未入力'}</div>
            )}
            <div className="bubble-resize" onPointerDown={(e) => startDrag(d, 'resize', e)} />
          </div>
        );
      })}
      <button
        type="button"
        className="tiny bubble-add"
        draggable={false}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          const id = api.addDialogue(sceneId);
          setEditingId(id);
        }}
      >
        ＋吹き出し
      </button>
    </div>
  );
}

/** 種別色を紙の上で薄く敷く */
function tint(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.18)`;
}
