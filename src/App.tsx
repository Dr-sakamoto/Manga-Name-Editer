import { useEffect, useState } from 'react';
import { useAppState } from './lib/store';
import { useProjectApi } from './lib/api';
import { Header } from './components/Header';
import { SceneBoard } from './components/SceneBoard';
import { PageMap } from './components/PageMap';
import { ThreadNetwork } from './components/ThreadNetwork';
import { ThreadPanel } from './components/ThreadPanel';
import { Inspector } from './components/Inspector';
import { Warnings } from './components/Warnings';

type Tab = 'board' | 'pages' | 'threads' | 'check';

const TABS: { id: Tab; label: string }[] = [
  { id: 'board', label: '構成' },
  { id: 'pages', label: 'ページ割り' },
  { id: 'threads', label: 'フリ・オチ' },
  { id: 'check', label: '見直し' },
];

export default function App() {
  const state = useAppState();
  const api = useProjectApi(state);
  const [tab, setTab] = useState<Tab>('board');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) api.redo();
        else api.undo();
      } else if (key === 'y') {
        e.preventDefault();
        api.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);

  const problems = api.warnings.filter((w) => w.level !== 'info').length;

  return (
    <div className="app">
      <Header api={api} state={state} />

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'check' && problems > 0 && <span className="badge">{problems}</span>}
          </button>
        ))}
      </nav>

      <div className="main">
        <div className="pane-main">
          {tab === 'board' && <SceneBoard api={api} />}
          {tab === 'pages' && <PageMap api={api} />}
          {tab === 'threads' && (
            <>
              <ThreadNetwork api={api} />
              <ThreadPanel api={api} />
            </>
          )}
          {tab === 'check' && <Warnings api={api} />}
        </div>
        <aside className="pane-side">
          <Inspector api={api} />
        </aside>
      </div>
    </div>
  );
}
