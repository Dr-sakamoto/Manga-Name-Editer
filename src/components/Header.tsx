import { useState } from 'react';
import type { Api } from '../lib/api';
import type { AppState } from '../lib/store';
import { PageMeter } from './PageMeter';
import { DataDialog } from './DataDialog';
import { CharacterDialog } from './CharacterDialog';
import { DialogueDialog } from './DialogueDialog';
import { emptyProject, sampleProject } from '../lib/sample';

export function Header({ api, state }: { api: Api; state: AppState }) {
  const { project } = api;
  const [dataOpen, setDataOpen] = useState(false);
  const [charOpen, setCharOpen] = useState(false);
  const [dialogueOpen, setDialogueOpen] = useState(false);

  return (
    <header className="header">
      <span className="logo">ネーム</span>

      <select
        value={project.id}
        onChange={(e) => state.selectProject(e.target.value)}
        style={{ width: 'auto', maxWidth: 180 }}
        title="作品を切り替える"
      >
        {state.data.projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title || '無題'}
          </option>
        ))}
      </select>

      <input
        className="title-input"
        value={project.title}
        placeholder="作品名"
        onChange={(e) => api.updateProject((p) => ({ ...p, title: e.target.value }), 'title')}
      />

      <div className="hgroup">
        <button
          className="ghost tiny"
          title="新しいネームを作る"
          onClick={() => state.addProject(emptyProject('無題のネーム'))}
        >
          ＋新規
        </button>
        <button
          className="ghost tiny"
          title="サンプルを読み込む"
          onClick={() => state.addProject(sampleProject())}
        >
          サンプル
        </button>
        <button
          className="ghost tiny danger"
          title="このネームを削除"
          onClick={() => {
            if (confirm(`「${project.title}」を削除します。よろしいですか？`)) {
              state.deleteProject(project.id);
            }
          }}
        >
          削除
        </button>
      </div>

      <div className="hgroup">
        総ページ
        <input
          className="pages-input"
          type="number"
          min={1}
          max={999}
          value={project.totalPages}
          onChange={(e) =>
            api.updateProject(
              (p) => ({
                ...p,
                totalPages: Math.max(1, Math.min(999, Number(e.target.value) || 1)),
              }),
              'totalPages',
            )
          }
        />
        <label className="hgroup" title="1ページ目を単独ページ（右起こし）として見開きを組む">
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={project.singleFirstPage}
            onChange={(e) => api.updateProject((p) => ({ ...p, singleFirstPage: e.target.checked }))}
          />
          扉あり
        </label>
      </div>

      <div className="hgroup">
        <button className="ghost tiny" onClick={() => setCharOpen(true)} title="登場人物を登録する">
          登場人物
        </button>
        <button className="ghost tiny" onClick={() => setDialogueOpen(true)} title="セリフの一覧を編集する">
          セリフ
        </button>
      </div>

      <div className="spacer" />

      <PageMeter api={api} />

      <div className="hgroup">
        <button className="ghost tiny" onClick={api.undo} disabled={!api.canUndo} title="元に戻す (Ctrl+Z)">
          ↩︎
        </button>
        <button className="ghost tiny" onClick={api.redo} disabled={!api.canRedo} title="やり直す (Ctrl+Shift+Z)">
          ↪︎
        </button>
        <button className="ghost tiny" onClick={() => setDataOpen(true)} title="JSONで書き出し／読み込み">
          データ
        </button>
      </div>

      {dataOpen && <DataDialog api={api} state={state} onClose={() => setDataOpen(false)} />}
      {charOpen && <CharacterDialog api={api} onClose={() => setCharOpen(false)} />}
      {dialogueOpen && <DialogueDialog api={api} onClose={() => setDialogueOpen(false)} />}
    </header>
  );
}
