import { uid } from './layout';
import type { Character, Dialogue, Project, Scene, Thread, Link } from './types';

export const THREAD_COLORS = [
  '#5b8dd9',
  '#d9534f',
  '#4c9a8f',
  '#d98b3a',
  '#a072d0',
  '#c86bbd',
  '#5fa8d3',
  '#8a9b3c',
];

export function nextThreadColor(used: number): string {
  return THREAD_COLORS[used % THREAD_COLORS.length];
}

export function emptyProject(title = '新しいネーム'): Project {
  return {
    id: uid('pj'),
    title,
    totalPages: 32,
    singleFirstPage: true,
    scenes: [],
    threads: [],
    links: [],
    characters: [],
    dialogues: [],
    updatedAt: Date.now(),
  };
}

/** 起動時に何もない状態を避けるためのサンプル。フリ・オチの網の形が分かるように作ってある */
export function sampleProject(): Project {
  const s = (
    id: string,
    parentId: string | null,
    title: string,
    ratio: number,
    kind: Scene['kind'],
    event = '',
    note = '',
  ): Scene => ({
    id,
    parentId,
    title,
    ratio,
    event,
    note,
    kind,
    collapsed: false,
    orientation: 'horizontal',
    locked: false,
  });

  const scenes: Scene[] = [
    s('sc_open', null, '日常の朝', 100, 'scene', '主人公が誰にも言えない荷物を鞄に詰めて家を出る', '説明はここに寄せない。持ち物のアップだけ'),
    s('sc_tail', null, '尾行', 150, 'scene', 'コートの人物が主人公の後ろを一定の距離で歩き続ける', '1.5ページ。最後のコマで目線が合う'),
    s('sc_info', null, '街の噂', 50, 'explain', '街頭ニュースで連続失踪事件が流れる', '説明コマ。半ページで足りる'),
    s('sc_trap', null, '路地で囲まれる', 100, 'action', '三人組が主人公を路地に追い込む', ''),
    s('sc_save', null, '謎の人物が助ける', 200, 'action', 'コートの人物が割って入り、三人を制圧する', '分割済み。決めゴマは見開き想定'),
    s('sc_save_1', 'sc_save', '構える', 50, 'action', 'コートの下から銃を抜き、構える', ''),
    s('sc_save_2', 'sc_save', '引き金をひく', 50, 'action', '指がゆっくり引き金にかかる', 'ここでタメる'),
    s('sc_save_3', 'sc_save', 'うつ', 100, 'action', '一発で三人が沈む', '1ページ2コマの決め'),
    s('sc_steal', null, '盗まれる', 100, 'scene', '助けた直後、その人物が主人公の鞄から資料を抜き取って消える', ''),
    s('sc_chase', null, '追う', 50, 'action', '主人公が走り出す', ''),
  ];

  const t = (id: string, label: string, kind: Thread['kind'], color: string, note = ''): Thread => ({
    id,
    label,
    kind,
    color,
    note,
  });

  const threads: Thread[] = [
    t('th_enemy', 'こいつは敵なのでは？', 'question', THREAD_COLORS[0]),
    t('th_hide', '主人公は何かを隠している', 'question', THREAD_COLORS[2]),
    t('th_purpose', 'じゃあ本当の目的は何だ？', 'question', THREAD_COLORS[1]),
    t('th_danger', '主人公は無事では済まない', 'anxiety', THREAD_COLORS[3]),
  ];

  const l = (sceneId: string, threadId: string, role: Link['role'], note = ''): Link => ({
    id: uid('lk'),
    sceneId,
    threadId,
    role,
    note,
  });

  const links: Link[] = [
    l('sc_open', 'th_hide', 'raise', '中身を見せずに閉じる'),
    l('sc_tail', 'th_enemy', 'raise', '距離を詰めない不気味さで「敵か」と思わせる'),
    l('sc_tail', 'th_hide', 'reinforce', '尾行される理由＝隠し事、と読者が結びつける'),
    l('sc_info', 'th_danger', 'raise', '失踪事件のニュースで身の危険を予感させる'),
    l('sc_trap', 'th_danger', 'reinforce', '予感が現実になる'),
    l('sc_save', 'th_enemy', 'resolve', '敵ではなく味方だった、と一旦答えを出す'),
    l('sc_save', 'th_danger', 'resolve', '危機そのものは去る'),
    l('sc_save', 'th_hide', 'reinforce', '助けられる理由がまだ分からず、隠し事の疑いが濃くなる'),
    l('sc_steal', 'th_purpose', 'raise', '味方という答えを壊し、新しい問いを立てる'),
    l('sc_steal', 'th_hide', 'twist', '隠していた物が具体的な「資料」だと分かり、問いが形を変える'),
  ];

  const characters: Character[] = [
    { id: 'ch_hero', name: '主人公', color: THREAD_COLORS[0] },
    { id: 'ch_coat', name: 'コートの人物', color: THREAD_COLORS[1] },
  ];

  const dialogues: Dialogue[] = [
    {
      id: uid('dl'),
      sceneId: 'sc_tail',
      characterId: 'ch_hero',
      text: '誰だ\nついてくるのは',
      x: 58,
      y: 10,
      width: 30,
      height: 42,
    },
  ];

  return {
    id: uid('pj'),
    title: 'サンプル：読切ネーム',
    totalPages: 16,
    singleFirstPage: true,
    scenes,
    threads,
    links,
    characters,
    dialogues,
    updatedAt: Date.now(),
  };
}
