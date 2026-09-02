import { useRef, useState } from 'react';
import type { Api } from '../lib/api';
import type { AppState } from '../lib/store';
import { normalizeProject } from '../lib/store';
import { uid } from '../lib/layout';
import type { Project } from '../lib/types';

/** ファイル名に使えない文字を除いて安全なファイル名にする */
function safeFileName(title: string) {
  const trimmed = title.trim().replace(/[\\/:*?"<>|]/g, '_');
  return trimmed || '無題のネーム';
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const json = JSON.stringify(api.project, null, 2);

  const importFromText = (raw: string, asNew: boolean) => {
    try {
      const parsed = JSON.parse(raw) as Partial<Project>;
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

  const doImport = (asNew: boolean) => importFromText(text, asNew);

  const downloadFile = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFileName(api.project.title)}.namedata.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChosen = async (file: File, asNew: boolean) => {
    try {
      const raw = await file.text();
      importFromText(raw, asNew);
    } catch (e) {
      setMessage(`読み込めませんでした：${(e as Error).message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>データ</h2>
        <div className="sub">
          ブラウザに自動保存されています。ファイルに書き出せば、データベースを使わずに別の端末へ進捗を持ち出せます。
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
              <button className="primary" onClick={downloadFile} title="このネームをファイルとして保存">
                ファイルに書き出す
              </button>
              <button onClick={onClose}>閉じる</button>
            </div>
          </>
        ) : (
          <>
            <div className="dialog-actions">
              <button onClick={() => fileInputRef.current?.click()}>ファイルを選ぶ…</button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChosen(file, true);
                }}
              />
              <span className="hint">選ぶと新しいネームとして追加されます</span>
            </div>
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
