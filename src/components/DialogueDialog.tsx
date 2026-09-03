import { useState } from 'react';
import type { Api } from '../lib/api';
import type { Dialogue, ID } from '../lib/types';

/**
 * 全シーン横断のセリフ一覧。ここで作ったセリフをページ割り画面で
 * 吹き出しとしてコマの上に配置する。テキストは縦書きで編集する。
 */
export function DialogueDialog({ api, onClose }: { api: Api; onClose: () => void }) {
  const { project } = api;
  const [newSceneId, setNewSceneId] = useState<ID | ''>('');
  const sceneMap = new Map(project.scenes.map((s) => [s.id, s]));
  const leafScenes = project.scenes.filter(
    (s) => !project.scenes.some((c) => c.parentId === s.id),
  );

  const bySceneId = new Map<ID, Dialogue[]>();
  for (const d of project.dialogues) {
    const arr = bySceneId.get(d.sceneId) ?? [];
    arr.push(d);
    bySceneId.set(d.sceneId, arr);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>セリフ</h2>
        <div className="sub">
          コマに置く吹き出しの元になるセリフです。改行した位置で縦書きの行が変わるので、文字数の収まり方を確認できます。位置や大きさはページ割り画面で調整します。
        </div>

        {project.dialogues.length === 0 && <div className="empty">まだありません</div>}

        {[...bySceneId.entries()].map(([sceneId, list]) => (
          <div key={sceneId}>
            <div className="dialogue-scene-title">{sceneMap.get(sceneId)?.title || '無題のシーン'}</div>
            {list.map((d) => (
              <div className="dialogue-row" key={d.id}>
                <select
                  value={d.characterId ?? ''}
                  onChange={(e) =>
                    api.patchDialogue(d.id, { characterId: e.target.value || null })
                  }
                >
                  <option value="">（役なし）</option>
                  {project.characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || '無名'}
                    </option>
                  ))}
                </select>
                <textarea
                  className="vertical-text"
                  rows={3}
                  value={d.text}
                  placeholder="セリフ（改行で好きな位置で折り返せます）"
                  onChange={(e) => api.patchDialogue(d.id, { text: e.target.value }, `dld${d.id}`)}
                />
                <button className="ghost tiny danger" onClick={() => api.deleteDialogue(d.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}

        <div className="dialog-actions" style={{ marginTop: 14 }}>
          <select
            value={newSceneId}
            onChange={(e) => setNewSceneId(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">シーンを選ぶ…</option>
            {leafScenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || '無題'}
              </option>
            ))}
          </select>
          <button
            className="primary"
            disabled={!newSceneId}
            onClick={() => {
              if (newSceneId) {
                api.addDialogue(newSceneId);
                setNewSceneId('');
              }
            }}
          >
            ＋セリフを追加
          </button>
          <button onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
