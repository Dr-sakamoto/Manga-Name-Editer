import { useState } from 'react';
import type { Api } from '../lib/api';
import { childrenOf, effectiveRatio, fmtPagePos, fmtPages, round2 } from '../lib/layout';
import {
  LINK_ROLES,
  PANEL_ORIENTATIONS,
  SCENE_KINDS,
  THREAD_KINDS,
  roleMeta,
  type ID,
  type LinkRole,
} from '../lib/types';
import { SplitDialog } from './SplitDialog';

export function Inspector({ api }: { api: Api }) {
  const sel = api.selection;
  if (!sel) {
    return (
      <div className="empty">
        シーンか予測を選ぶと、ここで中身を編集できます。
        <br />
        <br />
        シーンには「起こること」を、読者の頭に生まれる「予測」はフリ・オチとして繋ぎます。
      </div>
    );
  }
  if (sel.kind === 'scene') return <SceneInspector api={api} id={sel.id} />;
  return <ThreadInspector api={api} id={sel.id} />;
}

/* ------------------------------------------------------------------ */

function SceneInspector({ api, id }: { api: Api; id: ID }) {
  const scene = api.project.scenes.find((s) => s.id === id);
  const [splitOpen, setSplitOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newRole, setNewRole] = useState<LinkRole>('raise');

  if (!scene) return <div className="empty">シーンが見つかりません</div>;
  const place = api.layout.byId.get(id);
  const kids = childrenOf(api.project.scenes, id);
  const isGroup = kids.length > 0;
  const eff = round2(effectiveRatio(api.project.scenes, id));
  const links = api.project.links.filter((l) => l.sceneId === id);
  const threadMap = new Map(api.project.threads.map((t) => [t.id, t]));
  const sceneDialogues = api.project.dialogues.filter((d) => d.sceneId === id);

  // このシーンの時点で立っていて、まだ回収されていない予測
  const pending = api.analyses.filter((a) => {
    if (!place) return false;
    if (a.openPct === null || a.openPct > place.startPct) return false;
    if (a.resolvePct !== null && a.resolvePct <= place.startPct) return false;
    return !links.some((l) => l.threadId === a.thread.id);
  });

  return (
    <div>
      <div className="section">
        <h3>シーン</h3>
        <label className="field">
          <span>シーン名</span>
          <input
            value={scene.title}
            placeholder="例：敵を倒す"
            onChange={(e) => api.patchScene(id, { title: e.target.value }, `t${id}`)}
          />
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <label className="field" style={{ flex: 1 }}>
            <span>種別</span>
            <select value={scene.kind} onChange={(e) => api.setKind(id, e.target.value as never)}>
              {SCENE_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ width: 110 }}>
            <span>ページ占有率(%)</span>
            {isGroup ? (
              <input value={`${eff}（子の合計）`} readOnly title="子シーンの合計です" />
            ) : (
              <input
                type="number"
                step={25}
                min={0}
                value={scene.ratio}
                onChange={(e) =>
                  api.patchScene(id, { ratio: Math.max(0, Number(e.target.value) || 0) }, `r${id}`)
                }
              />
            )}
          </label>
        </div>

        {!isGroup && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
            {[25, 50, 100, 150, 200, 300].map((v) => (
              <button
                key={v}
                className="tiny"
                onClick={() => api.patchScene(id, { ratio: v })}
                title={fmtPages(v)}
              >
                {v}%
              </button>
            ))}
          </div>
        )}

        {!isGroup && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
            <label className="field" style={{ flex: 1 }}>
              <span>コマの向き</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {PANEL_ORIENTATIONS.map((o) => (
                  <button
                    key={o.value}
                    className="tiny"
                    disabled={scene.locked}
                    title={
                      o.value === 'vertical'
                        ? '隣の縦長・未ロックのコマと横に並ぶ'
                        : 'ページ幅いっぱいの単独の行になる'
                    }
                    onClick={() => api.patchScene(id, { orientation: o.value })}
                    style={
                      scene.orientation === o.value
                        ? { background: 'var(--accent)', color: '#12141a', fontWeight: 700 }
                        : undefined
                    }
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </label>
            {scene.locked && (
              <span className="hint" title="ページ割り画面のコマ右上のアイコンでロックを解除できます">
                🔒 ロック中
              </span>
            )}
          </div>
        )}

        <div className="hint" style={{ marginBottom: 10 }}>
          {place && (
            <>
              位置：{fmtPagePos(place.startPct)} 〜 P{place.endPage}（{fmtPages(place.lengthPct)}）
              {isGroup && Math.abs(eff - scene.ratio) > 0.01 && (
                <>
                  <br />
                  <span style={{ color: 'var(--warn)' }}>
                    分割前の想定 {scene.ratio}% との差 {eff - scene.ratio > 0 ? '+' : ''}
                    {round2(eff - scene.ratio)}%
                  </span>
                </>
              )}
            </>
          )}
        </div>

        <label className="field">
          <span>起こること</span>
          <textarea
            rows={3}
            value={scene.event}
            placeholder="このシーンで実際に描かれる出来事"
            onChange={(e) => api.patchScene(id, { event: e.target.value }, `e${id}`)}
          />
        </label>
        <label className="field">
          <span>メモ（コマ割り・説明の逃がし方など）</span>
          <textarea
            rows={2}
            value={scene.note}
            onChange={(e) => api.patchScene(id, { note: e.target.value }, `n${id}`)}
          />
        </label>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setSplitOpen(true)}>分割して具体化</button>
          <button onClick={() => api.addScene({ after: id })}>下に追加</button>
          <button onClick={() => api.duplicateScene(id)}>複製</button>
          <button className="danger" onClick={() => api.deleteScene(id)}>
            削除
          </button>
        </div>
      </div>

      <div className="section">
        <h3>セリフ</h3>
        {sceneDialogues.length === 0 && <div className="empty">まだありません</div>}
        {sceneDialogues.map((d) => (
          <div className="dialogue-row" key={d.id}>
            <select
              value={d.characterId ?? ''}
              onChange={(e) => api.patchDialogue(d.id, { characterId: e.target.value || null })}
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
              rows={4}
              value={d.text}
              placeholder="セリフ（改行で好きな位置で折り返せます）"
              onChange={(e) => api.patchDialogue(d.id, { text: e.target.value }, `dlt${d.id}`)}
            />
            <button className="ghost tiny danger" onClick={() => api.deleteDialogue(d.id)}>
              ×
            </button>
          </div>
        ))}
        <button className="tiny" onClick={() => api.addDialogue(id)}>
          ＋セリフを追加
        </button>
        <div className="hint" style={{ marginTop: 4 }}>
          吹き出しの位置や大きさは「ページ割り」タブでコマを選ぶと調整できます。
        </div>
      </div>

      <div className="section">
        <h3>フリ・オチ</h3>

        {links.length === 0 && <div className="empty">まだ繋がっていません</div>}
        {links.map((l) => {
          const thread = threadMap.get(l.threadId);
          if (!thread) return null;
          const meta = roleMeta(l.role);
          return (
            <div className="link-row" key={l.id}>
              <select
                className="role-select"
                value={l.role}
                onChange={(e) => api.patchLink(l.id, { role: e.target.value as LinkRole })}
                style={{ borderColor: meta.color }}
              >
                {LINK_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <div className="link-main">
                <div
                  className="link-title"
                  style={{ cursor: 'pointer' }}
                  onClick={() => api.selectThread(thread.id)}
                  title="この予測を開く"
                >
                  <span style={{ color: thread.color }}>●</span> {thread.label}
                </div>
                <input
                  className="tiny"
                  style={{ fontSize: 11, padding: '1px 4px', marginTop: 2 }}
                  placeholder="どう作用するか"
                  value={l.note}
                  onChange={(e) => api.patchLink(l.id, { note: e.target.value }, `ln${l.id}`)}
                />
              </div>
              <button className="ghost tiny danger" onClick={() => api.deleteLink(l.id)}>
                ×
              </button>
            </div>
          );
        })}

        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 3, marginBottom: 5, flexWrap: 'wrap' }}>
            {LINK_ROLES.map((r) => (
              <button
                key={r.value}
                className="tiny"
                title={r.hint}
                onClick={() => setNewRole(r.value)}
                style={{
                  background: newRole === r.value ? r.color : undefined,
                  color: newRole === r.value ? '#12141a' : undefined,
                  borderColor: newRole === r.value ? r.color : undefined,
                  fontWeight: newRole === r.value ? 700 : 400,
                }}
              >
                {r.short}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <input
              list="thread-labels"
              value={newLabel}
              placeholder="読者の頭に生まれる予測（例：こいつは敵なのでは？）"
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLabel.trim()) {
                  api.linkToLabel(id, newLabel, newRole);
                  setNewLabel('');
                }
              }}
            />
            <datalist id="thread-labels">
              {api.project.threads.map((t) => (
                <option key={t.id} value={t.label} />
              ))}
            </datalist>
            <button
              className="primary nowrap"
              disabled={!newLabel.trim()}
              onClick={() => {
                api.linkToLabel(id, newLabel, newRole);
                setNewLabel('');
              }}
            >
              繋ぐ
            </button>
          </div>
          <div className="hint" style={{ marginTop: 4 }}>
            {roleMeta(newRole).hint}。既にある予測の名前を入れると、それに繋がります。
          </div>
        </div>

        {pending.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="hint" style={{ marginBottom: 5 }}>
              ここまでに立っていて、まだ回収されていない予測：
            </div>
            {pending.map((a) => (
              <div className="link-row" key={a.thread.id}>
                <div className="link-main link-title">
                  <span style={{ color: a.thread.color }}>●</span> {a.thread.label}
                </div>
                <button
                  className="tiny"
                  title="このシーンで回収する"
                  onClick={() => api.addLink(id, a.thread.id, 'resolve')}
                >
                  回収
                </button>
                <button
                  className="tiny"
                  title="このシーンで強化する"
                  onClick={() => api.addLink(id, a.thread.id, 'reinforce')}
                >
                  強化
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {splitOpen && (
        <SplitDialog api={api} scene={scene} onClose={() => setSplitOpen(false)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ThreadInspector({ api, id }: { api: Api; id: ID }) {
  const analysis = api.analyses.find((a) => a.thread.id === id);
  if (!analysis) return <div className="empty">予測が見つかりません</div>;
  const t = analysis.thread;
  const sceneMap = new Map(api.project.scenes.map((s) => [s.id, s]));
  const threadMap = new Map(api.project.threads.map((x) => [x.id, x]));
  const parents = api.derivations.filter((d) => d.toThreadId === id);
  const children = api.derivations.filter((d) => d.fromThreadId === id);

  return (
    <div>
      <div className="section">
        <h3>読者の予測</h3>
        <label className="field">
          <span>読者の頭に生まれる言葉</span>
          <textarea
            rows={2}
            value={t.label}
            onChange={(e) => api.patchThread(id, { label: e.target.value }, `tl${id}`)}
          />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="field" style={{ flex: 1 }}>
            <span>種類</span>
            <select
              value={t.kind}
              onChange={(e) => api.patchThread(id, { kind: e.target.value as never })}
            >
              {THREAD_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ width: 72 }}>
            <span>色</span>
            <input
              type="color"
              value={t.color}
              onChange={(e) => api.patchThread(id, { color: e.target.value })}
              style={{ padding: 1, height: 30 }}
            />
          </label>
        </div>
        <label className="field">
          <span>メモ</span>
          <textarea
            rows={2}
            value={t.note}
            onChange={(e) => api.patchThread(id, { note: e.target.value }, `tn${id}`)}
          />
        </label>
        <div className="hint">
          状態：<span className={`status-${analysis.status}`}>{statusLabel(analysis.status)}</span>
          {analysis.openPct !== null && <> ／ フリ {fmtPagePos(analysis.openPct)}</>}
          {analysis.resolvePct !== null && <> → オチ {fmtPagePos(analysis.resolvePct - 0.01)}</>}
          {analysis.spanPct > 0 && <> ／ 引っぱり {fmtPages(analysis.spanPct)}</>}
        </div>
        <div style={{ marginTop: 8 }}>
          <button className="danger" onClick={() => api.deleteThread(id)}>
            この予測を削除
          </button>
        </div>
      </div>

      <div className="section">
        <h3>繋がっているシーン</h3>
        {analysis.points.length === 0 && <div className="empty">まだありません</div>}
        {analysis.points.map((pt) => {
          const meta = roleMeta(pt.link.role);
          return (
            <div className="link-row" key={pt.link.id}>
              <span className="role-tag" style={{ background: meta.color }}>
                {meta.short}
              </span>
              <div className="link-main">
                <div
                  className="link-title"
                  style={{ cursor: 'pointer' }}
                  onClick={() => api.selectScene(pt.scene.id)}
                >
                  {pt.scene.title || '無題'}
                </div>
                <div className="hint">
                  {fmtPagePos(pt.placement.startPct)}
                  {pt.link.note && ` ／ ${pt.link.note}`}
                </div>
              </div>
              <button className="ghost tiny danger" onClick={() => api.deleteLink(pt.link.id)}>
                ×
              </button>
            </div>
          );
        })}
      </div>

      {(parents.length > 0 || children.length > 0) && (
        <div className="section">
          <h3>予測のつながり</h3>
          {parents.map((d, i) => (
            <div className="hint" key={`p${i}`}>
              ← 「{threadMap.get(d.fromThreadId)?.label}」が
              <b>{sceneMap.get(d.sceneId)?.title || '無題'}</b>で
              {d.viaRole === 'resolve' ? '回収' : 'ねじれ'}た結果、この予測が生まれた
            </div>
          ))}
          {children.map((d, i) => (
            <div className="hint" key={`c${i}`}>
              → <b>{sceneMap.get(d.sceneId)?.title || '無題'}</b>でこの予測が
              {d.viaRole === 'resolve' ? '回収' : 'ねじれ'}、「
              {threadMap.get(d.toThreadId)?.label}」が生まれる
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'resolved':
      return '回収済み';
    case 'open':
      return '未回収';
    case 'broken':
      return 'フリがない';
    default:
      return '未接続';
  }
}
