import { useState } from 'react';
import type { Api } from '../lib/api';
import { fmtPagePos, fmtPages } from '../lib/layout';
import { THREAD_KINDS, roleMeta, type ThreadStatusFilter } from '../lib/types';
import { statusLabel } from './Inspector';

/** 予測（フリ）の一覧。未回収の洗い出しに使う */
export function ThreadPanel({ api }: { api: Api }) {
  const [filter, setFilter] = useState<ThreadStatusFilter>('all');
  const [label, setLabel] = useState('');

  const list = api.analyses.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'open') return a.status === 'open';
    if (filter === 'resolved') return a.status === 'resolved';
    return a.status === 'broken' || a.status === 'unlinked';
  });

  const counts = {
    all: api.analyses.length,
    open: api.analyses.filter((a) => a.status === 'open').length,
    resolved: api.analyses.filter((a) => a.status === 'resolved').length,
    problem: api.analyses.filter((a) => a.status === 'broken' || a.status === 'unlinked').length,
  };

  return (
    <div className="section">
      <h3>読者の予測（{counts.all}）</h3>

      <div className="board-toolbar">
        {(['all', 'open', 'resolved', 'problem'] as ThreadStatusFilter[]).map((f) => (
          <button
            key={f}
            className={filter === f ? 'primary tiny' : 'tiny'}
            onClick={() => setFilter(f)}
          >
            {{ all: 'ぜんぶ', open: '未回収', resolved: '回収済み', problem: '要確認' }[f]}(
            {counts[f === 'problem' ? 'problem' : f]})
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <input
          style={{ width: 240 }}
          value={label}
          placeholder="予測を追加（例：本当の目的は何だ？）"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && label.trim()) {
              api.selectThread(api.addThread(label.trim()));
              setLabel('');
            }
          }}
        />
        <button
          disabled={!label.trim()}
          onClick={() => {
            api.selectThread(api.addThread(label.trim()));
            setLabel('');
          }}
        >
          追加
        </button>
      </div>

      {list.length === 0 && <div className="empty">該当なし</div>}

      {list.map((a) => (
        <div
          key={a.thread.id}
          className={`thread-item${
            api.selection?.kind === 'thread' && api.selection.id === a.thread.id ? ' selected' : ''
          }`}
          style={{ ['--tc' as string]: a.thread.color }}
          onClick={() => api.selectThread(a.thread.id)}
        >
          <div className="t-label">{a.thread.label || '（無題の予測）'}</div>
          <div className="t-meta">
            <span className="chip">
              {THREAD_KINDS.find((k) => k.value === a.thread.kind)?.label}
            </span>
            <span className={`status-${a.status}`}>{statusLabel(a.status)}</span>
            {a.openPct !== null && <span>フリ {fmtPagePos(a.openPct)}</span>}
            {a.resolvePct !== null && <span>→ オチ {fmtPagePos(a.resolvePct - 0.01)}</span>}
            {a.spanPct > 0 && <span>引っぱり {fmtPages(a.spanPct)}</span>}
            <span style={{ display: 'flex', gap: 3 }}>
              {a.points.map((pt) => (
                <span
                  key={pt.link.id}
                  className="role-tag"
                  style={{ background: roleMeta(pt.link.role).color }}
                  title={`${pt.scene.title || '無題'}：${roleMeta(pt.link.role).label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    api.selectScene(pt.scene.id);
                  }}
                >
                  {roleMeta(pt.link.role).short}
                </span>
              ))}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
