import { useMemo } from 'react';
import type { Api } from '../lib/api';
import { fmtPagePos } from '../lib/layout';
import { LINK_ROLES, kindMeta, roleMeta, type ID, type LinkRole } from '../lib/types';

const PX_PER_PAGE = 84;
const PAD_L = 14;
const PAD_R = 40;
const RULER_H = 18;
const BAND_H = 26;
const LANE_H = 38;
const LOAD_H = 58;

function trunc(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** 役割ごとのマーカー形状。丸＝フリ、四角＝強化、三角＝ねじれ、菱形＝オチ */
function Marker({ role, x, y, color }: { role: LinkRole; x: number; y: number; color: string }) {
  const r = 5.5;
  if (role === 'raise') return <circle cx={x} cy={y} r={r} fill={color} stroke="#14161c" strokeWidth={1} />;
  if (role === 'reinforce')
    return (
      <rect x={x - r + 0.5} y={y - r + 0.5} width={r * 2 - 1} height={r * 2 - 1} rx={1} fill={color} stroke="#14161c" strokeWidth={1} />
    );
  if (role === 'twist')
    return (
      <polygon
        points={`${x},${y - r - 1} ${x + r + 0.5},${y + r} ${x - r - 0.5},${y + r}`}
        fill={color}
        stroke="#14161c"
        strokeWidth={1}
      />
    );
  return (
    <g>
      <polygon
        points={`${x},${y - r - 1.5} ${x + r + 1.5},${y} ${x},${y + r + 1.5} ${x - r - 1.5},${y}`}
        fill={color}
        stroke="#14161c"
        strokeWidth={1}
      />
      <polygon points={`${x},${y - 2.5} ${x + 2.5},${y} ${x},${y + 2.5} ${x - 2.5},${y}`} fill="#14161c" />
    </g>
  );
}

export function ThreadNetwork({ api }: { api: Api }) {
  const { project, layout, pages, analyses, derivations, readerLoad } = api;

  const pageCount = Math.max(pages.length, 1);
  const width = PAD_L + pageCount * PX_PER_PAGE + PAD_R;
  const x = (pct: number) => PAD_L + (pct / 100) * PX_PER_PAGE;

  const lanes = useMemo(
    () =>
      [...analyses].sort(
        (a, b) => (a.openPct ?? Number.MAX_SAFE_INTEGER) - (b.openPct ?? Number.MAX_SAFE_INTEGER),
      ),
    [analyses],
  );

  const laneTop = RULER_H + BAND_H + 16;
  const lanesH = Math.max(lanes.length * LANE_H, LANE_H);
  const loadTop = laneTop + lanesH + 14;
  const height = loadTop + LOAD_H + 22;

  const laneY = (i: number) => laneTop + i * LANE_H + LANE_H / 2;
  const laneIndex = new Map(lanes.map((l, i) => [l.thread.id, i]));
  const placementOf = (sceneId: ID) => layout.byId.get(sceneId);
  const selectedScene = api.selection?.kind === 'scene' ? api.selection.id : null;
  const selectedThread = api.selection?.kind === 'thread' ? api.selection.id : null;

  const maxLoad = Math.max(1, ...readerLoad.map((l) => l.open));
  const endPct = Math.max(layout.usedPct, layout.capacityPct);

  return (
    <div>
      <div className="graph-legend">
        {LINK_ROLES.map((r) => (
          <span className="k" key={r.value} title={r.hint}>
            <span className="sw" style={{ background: r.color }} />
            {r.label}
          </span>
        ))}
        <span className="k">─ 横棒＝フリからオチまでの引っぱり</span>
        <span className="k">┈ 点線＝まだ回収されていない</span>
        <span className="k">↷ 曲線＝回収と同時に生まれた新しい予測</span>
      </div>

      <div className="graph-wrap">
        <svg width={width} height={height} style={{ display: 'block' }}>
          <defs>
            <marker id="arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="#8b93a8" />
            </marker>
          </defs>

          {/* ページ目盛り */}
          {Array.from({ length: pageCount }, (_, i) => {
            const px = x(i * 100);
            const over = i + 1 > project.totalPages;
            return (
              <g key={i}>
                <line x1={px} y1={RULER_H - 6} x2={px} y2={height - 16} stroke={over ? '#4a2a2e' : '#262b38'} strokeWidth={1} />
                <text x={px + 4} y={12} fontSize={10} fill={over ? '#e06c75' : '#6b7488'} fontFamily="monospace">
                  {i + 1}
                </text>
              </g>
            );
          })}
          <line
            x1={x(project.totalPages * 100)}
            y1={0}
            x2={x(project.totalPages * 100)}
            y2={height - 16}
            stroke="#e06c75"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />

          {/* シーン帯 */}
          {layout.placements
            .filter((p) => p.leaf && p.lengthPct > 0)
            .map((p) => {
              const scene = project.scenes.find((s) => s.id === p.sceneId);
              if (!scene) return null;
              const w = Math.max(2, x(p.endPct) - x(p.startPct) - 1);
              const active = selectedScene === p.sceneId;
              return (
                <g
                  key={p.sceneId}
                  onClick={() => api.selectScene(p.sceneId)}
                  style={{ cursor: 'pointer' }}
                >
                  <title>{`${scene.title || '無題'}（${p.lengthPct}%）\n${scene.event}`}</title>
                  <rect
                    x={x(p.startPct)}
                    y={RULER_H}
                    width={w}
                    height={BAND_H}
                    rx={3}
                    fill={kindMeta(scene.kind).color}
                    opacity={active ? 0.95 : 0.55}
                    stroke={active ? '#fff' : 'transparent'}
                  />
                  {w > 34 && (
                    <text x={x(p.startPct) + 5} y={RULER_H + 17} fontSize={10} fill="#0f1116" fontWeight={700}>
                      {trunc(scene.title || '無題', Math.floor(w / 11))}
                    </text>
                  )}
                </g>
              );
            })}

          {/* 選択中シーンの縦帯 */}
          {selectedScene &&
            placementOf(selectedScene) &&
            (() => {
              const p = placementOf(selectedScene)!;
              return (
                <rect
                  x={x(p.startPct)}
                  y={laneTop - 8}
                  width={Math.max(2, x(p.endPct) - x(p.startPct))}
                  height={lanesH + 12}
                  fill="rgba(122,162,247,.09)"
                />
              );
            })()}

          {/* スレッド（読者の予測）のレーン */}
          {lanes.map((a, i) => {
            const y = laneY(i);
            const open = a.openPct ?? 0;
            const resolved = a.resolvePct;
            const isSel = selectedThread === a.thread.id;
            return (
              <g key={a.thread.id}>
                <line
                  x1={PAD_L}
                  y1={y + LANE_H / 2 - 1}
                  x2={width - PAD_R + 20}
                  y2={y + LANE_H / 2 - 1}
                  stroke="#20242e"
                />
                {a.points.length > 0 && (
                  <>
                    <line
                      x1={x(open)}
                      y1={y}
                      x2={x(resolved ?? endPct)}
                      y2={y}
                      stroke={a.thread.color}
                      strokeWidth={isSel ? 3.5 : 2}
                      strokeDasharray={resolved === null ? '4 4' : undefined}
                      opacity={resolved === null ? 0.65 : 0.9}
                    />
                    {resolved === null && (
                      <text
                        x={x(a.points[a.points.length - 1].placement.startPct) + 12}
                        y={y + 3.5}
                        fontSize={10}
                        fill="#e0a34a"
                      >
                        未回収 →
                      </text>
                    )}
                  </>
                )}

                <text
                  x={a.points.length > 0 ? x(open) + 2 : PAD_L}
                  y={y - 9}
                  fontSize={11}
                  fill={isSel ? '#fff' : a.thread.color}
                  fontWeight={isSel ? 700 : 500}
                  style={{ cursor: 'pointer' }}
                  onClick={() => api.selectThread(a.thread.id)}
                >
                  {trunc(a.thread.label || '（無題の予測）', 26)}
                </text>

                {a.points.map((pt) => {
                  const px = x(
                    pt.link.role === 'resolve'
                      ? Math.max(pt.placement.startPct, pt.placement.endPct - 1)
                      : pt.placement.startPct,
                  );
                  return (
                    <g
                      key={pt.link.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => api.selectScene(pt.scene.id)}
                    >
                      <title>
                        {`${roleMeta(pt.link.role).label}／${pt.scene.title || '無題'}（${fmtPagePos(
                          pt.placement.startPct,
                        )}）${pt.link.note ? `\n${pt.link.note}` : ''}`}
                      </title>
                      <Marker role={pt.link.role} x={px} y={y} color={roleMeta(pt.link.role).color} />
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* 回収と同時に生まれる新しい予測（派生の枝） */}
          {derivations.map((d, i) => {
            const from = laneIndex.get(d.fromThreadId);
            const to = laneIndex.get(d.toThreadId);
            const p = placementOf(d.sceneId);
            if (from === undefined || to === undefined || !p) return null;
            const x1 = x(Math.max(p.startPct, p.endPct - 1));
            const x2 = x(p.startPct);
            const y1 = laneY(from);
            const y2 = laneY(to);
            const bulge = 26 + Math.min(30, Math.abs(y2 - y1) / 3);
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${x1 + bulge} ${y1}, ${x2 + bulge} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="#8b93a8"
                strokeWidth={1.2}
                strokeDasharray="2 3"
                markerEnd="url(#arrow)"
                opacity={0.9}
              />
            );
          })}

          {/* 読者が同時に抱えている予測の数 */}
          <text x={PAD_L} y={loadTop - 4} fontSize={10} fill="#6b7488">
            読者が同時に抱えている予測の数（最大 {maxLoad}）
          </text>
          {readerLoad.map((l) => {
            const h = (l.open / maxLoad) * LOAD_H;
            return (
              <g key={l.page}>
                <title>{`P${l.page}：${l.open}個`}</title>
                <rect
                  x={x((l.page - 1) * 100) + 1}
                  y={loadTop + LOAD_H - h}
                  width={PX_PER_PAGE - 2}
                  height={h}
                  fill={l.open === 0 ? '#3a4050' : l.open > 4 ? '#e0a34a' : '#4c9a8f'}
                  opacity={(l.page - 1) * 100 >= layout.usedPct ? 0.25 : 0.75}
                />
                {l.open > 0 && (
                  <text
                    x={x((l.page - 1) * 100) + PX_PER_PAGE / 2}
                    y={loadTop + LOAD_H - h - 3}
                    fontSize={9}
                    fill="#9aa3b8"
                    textAnchor="middle"
                  >
                    {l.open}
                  </text>
                )}
              </g>
            );
          })}
          <line
            x1={PAD_L}
            y1={loadTop + LOAD_H}
            x2={width - PAD_R}
            y2={loadTop + LOAD_H}
            stroke="#333949"
          />
        </svg>
      </div>

      {lanes.length === 0 && (
        <div className="empty">
          まだ予測がありません。シーンを選んで「フリ・オチ」から、読者の頭に生まれる言葉を繋いでください。
        </div>
      )}
    </div>
  );
}
