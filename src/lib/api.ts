import { useCallback, useMemo, useState } from 'react';
import type { AppState } from './store';
import type { ID, Link, LinkRole, Scene, SceneKind, Thread } from './types';
import {
  analyzeThreads,
  collectWarnings,
  computeLayout,
  computePages,
  computeReaderLoad,
  deriveThreadChains,
  indentScene,
  moveScene,
  nudgeScene,
  outdentScene,
  removeScene,
  splitScene,
  subtreeIds,
  uid,
  type DropPosition,
  type SplitPart,
} from './layout';
import { nextThreadColor } from './sample';

export type Selection = { kind: 'scene' | 'thread'; id: ID } | null;

export function useProjectApi(state: AppState) {
  const { project, updateProject } = state;
  const [selection, setSelection] = useState<Selection>(null);

  const layout = useMemo(() => computeLayout(project), [project]);
  const pages = useMemo(() => computePages(project, layout), [project, layout]);
  const analyses = useMemo(() => analyzeThreads(project, layout), [project, layout]);
  const derivations = useMemo(() => deriveThreadChains(project), [project]);
  const readerLoad = useMemo(
    () => computeReaderLoad(analyses, pages.length),
    [analyses, pages.length],
  );
  const warnings = useMemo(
    () => collectWarnings(project, layout, analyses),
    [project, layout, analyses],
  );

  const selectScene = useCallback((id: ID | null) => {
    setSelection(id ? { kind: 'scene', id } : null);
  }, []);
  const selectThread = useCallback((id: ID | null) => {
    setSelection(id ? { kind: 'thread', id } : null);
  }, []);

  /* ---------------- シーン ---------------- */

  const addScene = useCallback(
    (
      opts: {
        after?: ID | null;
        parentId?: ID | null;
        title?: string;
        ratio?: number;
        kind?: SceneKind;
      } = {},
    ) => {
      const id = uid('sc');
      updateProject((p) => {
        const anchor = opts.after ? p.scenes.findIndex((s) => s.id === opts.after) : -1;
        const parentId =
          opts.parentId !== undefined
            ? opts.parentId
            : anchor >= 0
              ? p.scenes[anchor].parentId
              : null;
        const scene: Scene = {
          id,
          parentId,
          title: opts.title ?? '',
          ratio: opts.ratio ?? 100,
          event: '',
          note: '',
          kind: opts.kind ?? 'scene',
          collapsed: false,
        };
        const scenes = [...p.scenes];
        if (anchor >= 0) {
          // 対象の子孫の後ろに入れる
          const skip = subtreeIds(p.scenes, p.scenes[anchor].id).length;
          scenes.splice(anchor + skip, 0, scene);
        } else {
          scenes.push(scene);
        }
        return { ...p, scenes };
      });
      selectScene(id);
      return id;
    },
    [updateProject, selectScene],
  );

  const patchScene = useCallback(
    (id: ID, patch: Partial<Scene>, mergeKey?: string) => {
      updateProject(
        (p) => ({
          ...p,
          scenes: p.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        }),
        mergeKey,
      );
    },
    [updateProject],
  );

  const deleteScene = useCallback(
    (id: ID) => {
      updateProject((p) => {
        const gone = new Set(subtreeIds(p.scenes, id));
        return {
          ...p,
          scenes: removeScene(p.scenes, id),
          links: p.links.filter((l) => !gone.has(l.sceneId)),
        };
      });
      setSelection((sel) => (sel?.kind === 'scene' && sel.id === id ? null : sel));
    },
    [updateProject],
  );

  const duplicateScene = useCallback(
    (id: ID) => {
      updateProject((p) => {
        const ids = subtreeIds(p.scenes, id);
        const idSet = new Set(ids);
        const idMap = new Map(ids.map((old) => [old, uid('sc')]));
        const originals = p.scenes.filter((s) => idSet.has(s.id));
        const copies = originals.map((s) => ({
          ...s,
          id: idMap.get(s.id)!,
          parentId: s.id === id ? s.parentId : idMap.get(s.parentId!) ?? null,
          title: s.id === id ? `${s.title} のコピー` : s.title,
        }));
        const lastIdx = p.scenes.findIndex((s) => s.id === ids[ids.length - 1]);
        const scenes = [...p.scenes];
        scenes.splice(lastIdx + 1, 0, ...copies);
        return { ...p, scenes };
      });
    },
    [updateProject],
  );

  const move = useCallback(
    (dragId: ID, targetId: ID | null, position: DropPosition) => {
      updateProject((p) => ({ ...p, scenes: moveScene(p.scenes, dragId, targetId, position) }));
    },
    [updateProject],
  );

  const nudge = useCallback(
    (id: ID, dir: -1 | 1) => updateProject((p) => ({ ...p, scenes: nudgeScene(p.scenes, id, dir) })),
    [updateProject],
  );
  const indent = useCallback(
    (id: ID) => updateProject((p) => ({ ...p, scenes: indentScene(p.scenes, id) })),
    [updateProject],
  );
  const outdent = useCallback(
    (id: ID) => updateProject((p) => ({ ...p, scenes: outdentScene(p.scenes, id) })),
    [updateProject],
  );

  const split = useCallback(
    (id: ID, parts: SplitPart[]) =>
      updateProject((p) => ({ ...p, scenes: splitScene(p.scenes, id, parts) })),
    [updateProject],
  );

  const setKind = useCallback((id: ID, kind: SceneKind) => patchScene(id, { kind }), [patchScene]);

  /* ---------------- スレッド（読者の予測） ---------------- */

  const addThread = useCallback(
    (label: string, kind: Thread['kind'] = 'question') => {
      const id = uid('th');
      updateProject((p) => ({
        ...p,
        threads: [
          ...p.threads,
          { id, label, kind, note: '', color: nextThreadColor(p.threads.length) },
        ],
      }));
      return id;
    },
    [updateProject],
  );

  const patchThread = useCallback(
    (id: ID, patch: Partial<Thread>, mergeKey?: string) =>
      updateProject(
        (p) => ({
          ...p,
          threads: p.threads.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }),
        mergeKey,
      ),
    [updateProject],
  );

  const deleteThread = useCallback(
    (id: ID) => {
      updateProject((p) => ({
        ...p,
        threads: p.threads.filter((t) => t.id !== id),
        links: p.links.filter((l) => l.threadId !== id),
      }));
      setSelection((sel) => (sel?.kind === 'thread' && sel.id === id ? null : sel));
    },
    [updateProject],
  );

  /* ---------------- リンク（シーン×予測） ---------------- */

  const addLink = useCallback(
    (sceneId: ID, threadId: ID, role: LinkRole, note = '') => {
      const id = uid('lk');
      updateProject((p) => {
        const dup = p.links.find(
          (l) => l.sceneId === sceneId && l.threadId === threadId && l.role === role,
        );
        if (dup) return p;
        return { ...p, links: [...p.links, { id, sceneId, threadId, role, note }] };
      });
      return id;
    },
    [updateProject],
  );

  const patchLink = useCallback(
    (id: ID, patch: Partial<Link>, mergeKey?: string) =>
      updateProject(
        (p) => ({
          ...p,
          links: p.links.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        }),
        mergeKey,
      ),
    [updateProject],
  );

  const deleteLink = useCallback(
    (id: ID) => updateProject((p) => ({ ...p, links: p.links.filter((l) => l.id !== id) })),
    [updateProject],
  );

  /** ラベルが既存スレッドと一致すればそれを使い、無ければ作ってから繋ぐ */
  const linkToLabel = useCallback(
    (sceneId: ID, label: string, role: LinkRole, kind: Thread['kind'] = 'question') => {
      const trimmed = label.trim();
      if (!trimmed) return;
      const existing = project.threads.find((t) => t.label === trimmed);
      if (existing) {
        addLink(sceneId, existing.id, role);
        return existing.id;
      }
      const id = uid('th');
      updateProject((p) => ({
        ...p,
        threads: [
          ...p.threads,
          { id, label: trimmed, kind, note: '', color: nextThreadColor(p.threads.length) },
        ],
        links: [...p.links, { id: uid('lk'), sceneId, threadId: id, role, note: '' }],
      }));
      return id;
    },
    [project.threads, addLink, updateProject],
  );

  return {
    project,
    layout,
    pages,
    analyses,
    derivations,
    readerLoad,
    warnings,
    selection,
    setSelection,
    selectScene,
    selectThread,
    updateProject,
    addScene,
    patchScene,
    deleteScene,
    duplicateScene,
    move,
    nudge,
    indent,
    outdent,
    split,
    setKind,
    addThread,
    patchThread,
    deleteThread,
    addLink,
    patchLink,
    deleteLink,
    linkToLabel,
    undo: state.undo,
    redo: state.redo,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
  };
}

export type Api = ReturnType<typeof useProjectApi>;
