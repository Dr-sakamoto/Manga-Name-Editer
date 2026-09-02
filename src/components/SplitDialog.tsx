import { useState } from 'react';
import type { Api } from '../lib/api';
import { childrenOf, effectiveRatio, fmtPages, round2, type SplitPart } from '../lib/layout';
import type { Scene } from '../lib/types';

/**
 * シーンを子シーンに分割して具体化するダイアログ。
 * 「敵を倒す:200%」→「構える:50%」「引き金をひく:50%」「うつ:100%」
 */
export function SplitDialog({
  api,
  scene,
  onClose,
}: {
  api: Api;
  scene: Scene;
  onClose: () => void;
}) {
  const existing = childrenOf(api.project.scenes, scene.id);
  const target = existing.length > 0 ? effectiveRatio(api.project.scenes, scene.id) : scene.ratio;
  const [parts, setParts] = useState<SplitPart[]>([
    { title: '', ratio: round2(target / 2) },
    { title: '', ratio: round2(target - round2(target / 2)) },
  ]);

  const sum = round2(parts.reduce((s, p) => s + (Number(p.ratio) || 0), 0));
  const diff = round2(sum - target);
  const setPart = (i: number, patch: Partial<SplitPart>) =>
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const even = (n: number) => {
    const each = round2(target / n);
    const list = Array.from({ length: n }, (_, i) => ({
      title: parts[i]?.title ?? '',
      ratio: i === n - 1 ? round2(target - each * (n - 1)) : each,
    }));
    setParts(list);
  };

  const commit = () => {
    const usable = parts
      .map((p) => ({ title: p.title.trim(), ratio: Math.max(0, Number(p.ratio) || 0) }))
      .filter((p) => p.title !== '' || p.ratio > 0);
    if (usable.length === 0) return;
    api.split(scene.id, usable);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>「{scene.title || '無題'}」を分割する</h2>
        <div className="sub">
          分割前：{target}%（{fmtPages(target)}）
          {existing.length > 0 && ' ／ すでにある子シーンの後ろに足されます'}
        </div>

        {parts.map((p, i) => (
          <div className="split-row" key={i}>
            <span className="idx">{i + 1}</span>
            <input
              autoFocus={i === 0}
              value={p.title}
              placeholder={['構える', '引き金をひく', 'うつ'][i] ?? 'シーン名'}
              onChange={(e) => setPart(i, { title: e.target.value })}
            />
            <span className="r">
              <input
                type="number"
                step={25}
                min={0}
                value={p.ratio}
                onChange={(e) => setPart(i, { ratio: Number(e.target.value) || 0 })}
              />
            </span>
            <button
              className="ghost tiny danger"
              onClick={() => setParts((prev) => prev.filter((_, idx) => idx !== i))}
              disabled={parts.length <= 1}
            >
              ×
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setParts((prev) => [...prev, { title: '', ratio: 0 }])}>
            ＋ 行を足す
          </button>
          <button onClick={() => even(2)}>均等に2分割</button>
          <button onClick={() => even(3)}>均等に3分割</button>
          <button onClick={() => even(4)}>均等に4分割</button>
        </div>

        <div className="sum-line">
          <span>合計 {sum}%（{fmtPages(sum)}）</span>
          <span className={Math.abs(diff) < 0.01 ? 'good' : 'bad'}>
            {Math.abs(diff) < 0.01
              ? '分割前とぴったり'
              : `分割前との差 ${diff > 0 ? '+' : ''}${diff}%`}
          </span>
        </div>
        <div className="hint" style={{ marginTop: 6 }}>
          合計がずれたままでも登録できます。差はシーン一覧と警告に出るので、後から詰めれば大丈夫です。
        </div>

        <div className="dialog-actions">
          <button onClick={onClose}>やめる</button>
          <button className="primary" onClick={commit}>
            分割する
          </button>
        </div>
      </div>
    </div>
  );
}
