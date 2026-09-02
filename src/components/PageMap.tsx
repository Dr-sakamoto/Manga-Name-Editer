import { useState } from 'react';
import type { Api } from '../lib/api';
import { fmtPages, toSpreads } from '../lib/layout';
import { kindMeta, type ID } from '../lib/types';

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
          白い余白は「まだ空いているページ」です。
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
                {info.slices.map((slice, si) => {
                  const scene = sceneMap.get(slice.sceneId);
                  if (!scene) return null;
                  const height = slice.to - slice.from;
                  const selected =
                    api.selection?.kind === 'scene' && api.selection.id === slice.sceneId;
                  const hinted = dropHint?.sceneId === slice.sceneId ? ` drop-${dropHint.pos}` : '';
                  return (
                    <div
                      key={`${slice.sceneId}-${si}`}
                      className={`page-slice${selected ? ' selected' : ''}${hinted}${
                        slice.startsHere ? '' : ' cont-top'
                      }`}
                      style={{
                        height: `${height}%`,
                        background: tint(kindMeta(scene.kind).color),
                        borderLeft: `3px solid ${kindMeta(scene.kind).color}`,
                      }}
                      draggable
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
                        scene.event ? `\n${scene.event}` : ''
                      }`}
                    >
                      <div className="slice-title">
                        {slice.startsHere ? '' : '↳ '}
                        {scene.title || '無題'}
                      </div>
                      {height >= 18 && (
                        <div className="slice-meta">
                          {slice.continued ? `${Math.round(height)}% / ${scene.ratio}%` : `${Math.round(height)}%`}
                        </div>
                      )}
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

/** 種別色を紙の上で薄く敷く */
function tint(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.18)`;
}
