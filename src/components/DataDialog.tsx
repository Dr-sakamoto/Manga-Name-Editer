import { useState } from 'react';
import type { Api } from '../lib/api';
import type { AppState } from '../lib/store';
import { normalizeProject } from '../lib/store';
import { uid } from '../lib/layout';
import type { Project } from '../lib/types';

/** JSON での書き出し・読み込み。バックアップと受け渡し用 */
export function DataDialog({
  api,
  state,
  onClose,
}: {
  api: Api;
  state: AppState;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const json = JSON.stringify(api.project, null, 2);

  const doImport = (asNew: boolean) => {
    try {
      const parsed = JSON.parse(text) as Partial<Project>;
      const project = normalizeProject(asNew ? { ...parsed, id: uid('pj') } : parsed);
      if (asNew) {
        state.addProject(project);
      } else {
        api.updateProject(() => project);
      }
      setMessage('読み込みました');
      onClose();
    } catch (e) {
      setMessage(`読み込めませんでした：${(e as Error).message}`);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>データ</h2>
        <div className="sub">
          ブラウザに自動保存されています。バックアップや別の端末への持ち出しはこの JSON で。
        </div>

        <div className="board-toolbar">
          <button className={tab === 'export' ? 'primary tiny' : 'tiny'} onClick={() => setTab('export')}>
            書き出し
          </button>
          <button className={tab === 'import' ? 'primary tiny' : 'tiny'} onClick={() => setTab('import')}>
            読み込み
          </button>
        </div>

        {tab === 'export' ? (
          <>
            <textarea className="textarea-json" readOnly value={json} onFocus={(e) => e.target.select()} />
            <div className="dialog-actions">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(json).then(
                    () => setMessage('コピーしました'),
                    () => setMessage('コピーできませんでした。全選択して手動でコピーしてください'),
                  );
                }}
              >
                クリップボードにコピー
              </button>
              <button className="primary" onClick={onClose}>
                閉じる
              </button>
            </div>
          </>
        ) : (
          <>
            <textarea
              className="textarea-json"
              value={text}
              placeholder="書き出した JSON を貼り付けてください"
              onChange={(e) => setText(e.target.value)}
            />
            <div className="dialog-actions">
              <button onClick={onClose}>やめる</button>
              <button disabled={!text.trim()} onClick={() => doImport(true)}>
                新しいネームとして追加
              </button>
              <button className="primary" disabled={!text.trim()} onClick={() => doImport(false)}>
                今のネームを置き換える
              </button>
            </div>
          </>
        )}
        {message && <div className="hint">{message}</div>}
      </div>
    </div>
  );
}
