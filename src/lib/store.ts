import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppData, ID, Project } from './types';
import { emptyProject, sampleProject } from './sample';
import { pruneLinks } from './layout';

const STORAGE_KEY = 'manga-name-editer/v1';
const HISTORY_LIMIT = 60;

function initialData(): AppData {
  const pj = sampleProject();
  return { version: 1, projects: [pj], currentProjectId: pj.id };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialData();
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed || !Array.isArray(parsed.projects) || parsed.projects.length === 0) {
      return initialData();
    }
    return {
      version: 1,
      projects: parsed.projects.map(normalizeProject),
      currentProjectId: parsed.currentProjectId ?? parsed.projects[0].id,
    };
  } catch {
    return initialData();
  }
}

/** 手で編集した JSON や古い保存データを読み込んでも壊れないように補完する */
export function normalizeProject(p: Partial<Project>): Project {
  const base = emptyProject(p.title ?? '無題');
  const project: Project = {
    ...base,
    ...p,
    id: p.id ?? base.id,
    title: p.title ?? base.title,
    totalPages: Number.isFinite(p.totalPages) ? Number(p.totalPages) : base.totalPages,
    singleFirstPage: p.singleFirstPage ?? true,
    scenes: (p.scenes ?? []).map((s) => ({
      id: s.id,
      parentId: s.parentId ?? null,
      title: s.title ?? '',
      ratio: Number.isFinite(s.ratio) ? Number(s.ratio) : 100,
      event: s.event ?? '',
      note: s.note ?? '',
      kind: s.kind ?? 'scene',
      collapsed: s.collapsed ?? false,
    })),
    threads: (p.threads ?? []).map((t) => ({
      id: t.id,
      label: t.label ?? '',
      kind: t.kind ?? 'question',
      note: t.note ?? '',
      color: t.color ?? '#5b8dd9',
    })),
    links: p.links ?? [],
    updatedAt: p.updatedAt ?? Date.now(),
  };
  // 親が存在しない孤児はルートに戻す
  const ids = new Set(project.scenes.map((s) => s.id));
  project.scenes = project.scenes.map((s) =>
    s.parentId && !ids.has(s.parentId) ? { ...s, parentId: null } : s,
  );
  project.links = pruneLinks(project);
  return project;
}

function save(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* 保存できなくても操作は続けられるようにする */
  }
}

interface HistoryState {
  data: AppData;
  past: AppData[];
  future: AppData[];
  /** 連続した同種の編集（文字入力など）を1つの履歴にまとめるためのキー */
  lastKey: string | null;
  lastAt: number;
}

const MERGE_WINDOW_MS = 1500;

export function useAppState() {
  const [state, setState] = useState<HistoryState>(() => ({
    data: loadData(),
    past: [],
    future: [],
    lastKey: null,
    lastAt: 0,
  }));

  useEffect(() => {
    save(state.data);
  }, [state.data]);

  /**
   * 履歴に残す変更。mergeKey を渡すと、短時間の同キーの変更は
   * 直前の履歴にまとめられる（文字入力で履歴が埋まらないように）
   */
  const update = useCallback((fn: (d: AppData) => AppData, mergeKey?: string) => {
    setState((prev) => {
      const next = fn(prev.data);
      if (next === prev.data) return prev;
      const now = Date.now();
      const merge = !!mergeKey && prev.lastKey === mergeKey && now - prev.lastAt < MERGE_WINDOW_MS;
      return {
        data: next,
        past: merge ? prev.past : [...prev.past, prev.data].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: mergeKey ?? null,
        lastAt: now,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      const last = prev.past[prev.past.length - 1];
      if (!last) return prev;
      return {
        data: last,
        past: prev.past.slice(0, -1),
        future: [prev.data, ...prev.future].slice(0, HISTORY_LIMIT),
        lastKey: null,
        lastAt: 0,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      const next = prev.future[0];
      if (!next) return prev;
      return {
        data: next,
        past: [...prev.past, prev.data].slice(-HISTORY_LIMIT),
        future: prev.future.slice(1),
        lastKey: null,
        lastAt: 0,
      };
    });
  }, []);

  const project = useMemo(() => {
    const { projects, currentProjectId } = state.data;
    return projects.find((p) => p.id === currentProjectId) ?? projects[0];
  }, [state.data]);

  /** 現在のプロジェクトだけを差し替える */
  const updateProject = useCallback(
    (fn: (p: Project) => Project, mergeKey?: string) => {
      update((d) => {
        const idx = d.projects.findIndex((p) => p.id === (d.currentProjectId ?? d.projects[0]?.id));
        if (idx < 0) return d;
        const nextProject = { ...fn(d.projects[idx]), updatedAt: Date.now() };
        const projects = [...d.projects];
        projects[idx] = nextProject;
        return { ...d, projects };
      }, mergeKey);
    },
    [update],
  );

  const selectProject = useCallback(
    (id: ID) => update((d) => ({ ...d, currentProjectId: id })),
    [update],
  );

  const addProject = useCallback(
    (p: Project) =>
      update((d) => ({ ...d, projects: [...d.projects, p], currentProjectId: p.id })),
    [update],
  );

  const deleteProject = useCallback(
    (id: ID) =>
      update((d) => {
        const projects = d.projects.filter((p) => p.id !== id);
        const fallback = projects[0] ?? emptyProject();
        const list = projects.length > 0 ? projects : [fallback];
        return {
          ...d,
          projects: list,
          currentProjectId: d.currentProjectId === id ? list[0].id : d.currentProjectId,
        };
      }),
    [update],
  );

  return {
    data: state.data,
    project,
    updateProject,
    selectProject,
    addProject,
    deleteProject,
    replaceAll: update,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}

export type AppState = ReturnType<typeof useAppState>;
