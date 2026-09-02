import type { Api } from '../lib/api';
import { fmtPages } from '../lib/layout';
import { kindMeta } from '../lib/types';

/** 総ページに対する使用／残りの帯。ページ境界に目盛りを打つ */
export function PageMeter({ api }: { api: Api }) {
  const { project, layout } = api;
  const total = Math.max(layout.capacityPct, layout.usedPct, 1);
  const leaves = layout.placements.filter((p) => p.leaf && p.lengthPct > 0);
  const over = layout.remainingPct < 0;
  const sceneMap = new Map(project.scenes.map((s) => [s.id, s]));

  return (
    <div className="meter" title="クリックでシーンを選択">
      <div className="meter-bar">
        {leaves.map((p) => {
          const scene = sceneMap.get(p.sceneId);
          if (!scene) return null;
          const beyond = p.startPct >= layout.capacityPct;
          return (
            <div
              key={p.sceneId}
              className="meter-seg"
              onClick={() => api.selectScene(p.sceneId)}
              style={{
                width: `${(p.lengthPct / total) * 100}%`,
                background: kindMeta(scene.kind).color,
                opacity: beyond ? 0.45 : 1,
                cursor: 'pointer',
              }}
              title={`${scene.title || '無題'} / ${p.lengthPct}%`}
            />
          );
        })}
        <div
          className="meter-seg"
          style={{ flex: 1, background: over ? 'rgba(224,108,117,.25)' : 'transparent' }}
        />
        <div className="meter-ticks">
          {Array.from({ length: Math.max(0, Math.ceil(total / 100) - 1) }, (_, i) => (
            <div
              key={i}
              className="meter-tick"
              style={{
                left: `${(((i + 1) * 100) / total) * 100}%`,
                background:
                  (i + 1) * 100 === layout.capacityPct
                    ? 'var(--err)'
                    : 'rgba(255,255,255,.16)',
              }}
            />
          ))}
        </div>
      </div>
      <div className={`meter-label${over ? ' over' : ''}`}>
        使用 <b>{fmtPages(layout.usedPct)}</b> / {project.totalPages}P ・{' '}
        {over ? '超過 ' : '残り '}
        <b>{fmtPages(Math.abs(layout.remainingPct))}</b>
      </div>
    </div>
  );
}
