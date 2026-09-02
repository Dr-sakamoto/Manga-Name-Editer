import type { Api } from '../lib/api';

/** 登場人物の一覧管理。セリフの色分け・役の割り当てに使う */
export function CharacterDialog({ api, onClose }: { api: Api; onClose: () => void }) {
  const { project } = api;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>登場人物</h2>
        <div className="sub">セリフに割り当てる登場人物を登録します。色は吹き出しの縁取りに使われます。</div>

        {project.characters.length === 0 && <div className="empty">まだ登録されていません</div>}
        {project.characters.map((c) => (
          <div className="character-row" key={c.id}>
            <input
              type="color"
              value={c.color}
              onChange={(e) => api.patchCharacter(c.id, { color: e.target.value })}
              title="表示色"
            />
            <input
              value={c.name}
              placeholder="名前"
              onChange={(e) => api.patchCharacter(c.id, { name: e.target.value }, `chn${c.id}`)}
            />
            <button className="ghost tiny danger" onClick={() => api.deleteCharacter(c.id)}>
              ×
            </button>
          </div>
        ))}

        <div className="dialog-actions">
          <button onClick={() => api.addCharacter('')}>＋登場人物を追加</button>
          <button className="primary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
