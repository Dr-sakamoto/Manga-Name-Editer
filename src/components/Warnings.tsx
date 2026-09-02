import type { Api } from '../lib/api';
import { fmtPages } from '../lib/layout';

/** 見直し用のチェックリスト。残ページ・分割のズレ・未回収のフリをまとめて出す */
export function Warnings({ api }: { api: Api }) {
  const { warnings, layout, analyses, project } = api;
  const openThreads = analyses.filter((a) => a.status === 'open');
  const longest = [...analyses].sort((a, b) => b.spanPct - a.spanPct)[0];
  const busiest = [...api.readerLoad].sort((a, b) => b.open - a.open)[0];
  const explainPct = project.scenes
    .filter((s) => s.kind === 'explain' && !project.scenes.some((c) => c.parentId === s.id))
    .reduce((sum, s) => sum + s.ratio, 0);

  return (
    <div>
      <div className="section">
        <h3>いまの状態</h3>
        <div className="warn-list">
          <div className="warn-item">
            <span className="lv info">頁</span>
            <span>
              使用 {fmtPages(layout.usedPct)} ／ 総 {project.totalPages}P ／{' '}
              {layout.remainingPct >= 0
                ? `残り ${fmtPages(layout.remainingPct)}`
                : `超過 ${fmtPages(-layout.remainingPct)}`}
              （必要 {layout.neededPages}P）
            </span>
          </div>
          <div className="warn-item">
            <span className="lv info">説明</span>
            <span>
              説明コマに {fmtPages(explainPct)}（全体の{' '}
              {layout.usedPct > 0 ? Math.round((explainPct / layout.usedPct) * 100) : 0}%）
            </span>
          </div>
          <div className="warn-item">
            <span className="lv info">フリ</span>
            <span>
              未回収 {openThreads.length}件 ／ 回収済み{' '}
              {analyses.filter((a) => a.status === 'resolved').length}件
              {longest && longest.spanPct > 0 && (
                <> ／ いちばん長い引っぱり「{longest.thread.label}」{fmtPages(longest.spanPct)}</>
              )}
            </span>
          </div>
          {busiest && (
            <div className="warn-item">
              <span className="lv info">負荷</span>
              <span>
                読者が同時に抱える予測の最大は P{busiest.page} の {busiest.open}件
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <h3>気になるところ（{warnings.filter((w) => w.level !== 'info').length}）</h3>
        <div className="warn-list">
          {warnings.length === 0 && <div className="empty">いまのところ問題なし</div>}
          {warnings.map((w, i) => (
            <div
              className="warn-item"
              key={i}
              onClick={() => {
                if (w.sceneId) api.selectScene(w.sceneId);
                else if (w.threadId) api.selectThread(w.threadId);
              }}
            >
              <span className={`lv ${w.level}`}>
                {w.level === 'error' ? '要修正' : w.level === 'warn' ? '注意' : '情報'}
              </span>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
