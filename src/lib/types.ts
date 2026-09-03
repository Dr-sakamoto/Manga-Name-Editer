/** 共通ID型 */
export type ID = string;

/**
 * シーン。ネームの最小構成単位。
 * ratio はページ占有率(%)。100 = 1ページ、200 = 2ページ、50 = 半ページ。
 * 子を持つシーンは「グループ」として扱い、実効占有率は子の合計になる。
 * ratio 自身は分割前に決めた「目標値」として残り、子合計とのズレを警告に使う。
 */
export interface Scene {
  id: ID;
  parentId: ID | null;
  title: string;
  /** ページ占有率(%)。子を持つ場合は目標値として保持 */
  ratio: number;
  /** 起こること（このシーンで実際に描かれる出来事） */
  event: string;
  /** 自由メモ。説明コマのやりくり用 */
  note: string;
  /** 分類。説明コマ／見せ場などのやりくりに使う */
  kind: SceneKind;
  /** 折りたたみ状態 */
  collapsed: boolean;
  /**
   * コマの向き。horizontal=横長（ページ幅いっぱいを単独で使う行になる）、
   * vertical=縦長（隣接する縦長・未ロックのコマと横に並んで1つの行を作る）
   */
  orientation: PanelOrientation;
  /**
   * ロック中は他のコマの含有率・向きの変更で自分の行が組み替わることがない
   * （常に単独の行として、自分の含有率だけで高さ・幅が決まる）
   */
  locked: boolean;
}

export type PanelOrientation = 'vertical' | 'horizontal';

export const PANEL_ORIENTATIONS: { value: PanelOrientation; label: string }[] = [
  { value: 'horizontal', label: '横長' },
  { value: 'vertical', label: '縦長' },
];

export type SceneKind = 'scene' | 'explain' | 'action' | 'emotion' | 'gag' | 'blank';

export const SCENE_KINDS: { value: SceneKind; label: string; color: string }[] = [
  { value: 'scene', label: 'シーン', color: '#6b7fd7' },
  { value: 'action', label: '見せ場', color: '#e0555b' },
  { value: 'emotion', label: '情感', color: '#c86bbd' },
  { value: 'explain', label: '説明', color: '#4c9a8f' },
  { value: 'gag', label: 'ギャグ', color: '#e0913a' },
  { value: 'blank', label: '空き', color: '#5a6070' },
];

export function kindMeta(kind: SceneKind) {
  return SCENE_KINDS.find((k) => k.value === kind) ?? SCENE_KINDS[0];
}

/**
 * 読者の脳内に生まれる無意識の予測・期待・疑問（フリが立てるもの）。
 * これ自体はシーンではなく「読者の状態」であり、複数シーンから
 * 立てられ・強化され・回収される多対多のネットワークを作る。
 */
export interface Thread {
  id: ID;
  /** 読者の脳内に生まれる言葉。例: 「こいつは敵なのでは？」 */
  label: string;
  kind: ThreadKind;
  note: string;
  color: string;
}

export type ThreadKind = 'question' | 'expectation' | 'anxiety' | 'promise';

export const THREAD_KINDS: { value: ThreadKind; label: string; hint: string }[] = [
  { value: 'question', label: '疑問', hint: '「これは何だ？」と読者が問いを持つ' },
  { value: 'expectation', label: '期待', hint: '「こうなるはず」と読者が先を待つ' },
  { value: 'anxiety', label: '不安', hint: '「まずいことになりそう」と読者が身構える' },
  { value: 'promise', label: '約束', hint: '作者が読者に「必ずやる」と示した約束' },
];

/** シーンと読者予測の接続。1シーンが複数スレッドに、1スレッドが複数シーンに繋がる */
export interface Link {
  id: ID;
  sceneId: ID;
  threadId: ID;
  role: LinkRole;
  /** そのシーンでどう作用するかのメモ */
  note: string;
}

export type LinkRole = 'raise' | 'reinforce' | 'twist' | 'resolve';

export const LINK_ROLES: {
  value: LinkRole;
  label: string;
  short: string;
  hint: string;
  color: string;
}[] = [
  {
    value: 'raise',
    label: 'フリ（立てる）',
    short: 'フリ',
    hint: 'このシーンが読者の予測を新しく生む',
    color: '#5b8dd9',
  },
  {
    value: 'reinforce',
    label: '強化（積む）',
    short: '強化',
    hint: '既にある予測をさらに濃くする',
    color: '#4c9a8f',
  },
  {
    value: 'twist',
    label: 'ねじれ（裏切る）',
    short: 'ねじれ',
    hint: '予測を裏切って別の形に変える。回収はしない',
    color: '#d98b3a',
  },
  {
    value: 'resolve',
    label: 'オチ（回収）',
    short: 'オチ',
    hint: 'この予測に答えを出して閉じる',
    color: '#d9534f',
  },
];

export function roleMeta(role: LinkRole) {
  return LINK_ROLES.find((r) => r.value === role) ?? LINK_ROLES[0];
}

export type ThreadStatusFilter = 'all' | 'open' | 'resolved' | 'problem';

/** 登場人物。セリフに紐づけて色分けする */
export interface Character {
  id: ID;
  name: string;
  color: string;
}

/**
 * セリフ（吹き出し）。1つのシーン（コマ）に複数持てる。
 * x/y/width/height はページ割り画面でのコマ内の位置・大きさ(%)。
 * text の改行はそのまま縦書きの行送りに使われる（文字数の調整に使える）。
 */
export interface Dialogue {
  id: ID;
  sceneId: ID;
  characterId: ID | null;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Project {
  id: ID;
  title: string;
  /** ネーム全体の総ページ数 */
  totalPages: number;
  /** 1ページ目を単独ページ（右起こし）として扱うか。見開きの割り付けに使う */
  singleFirstPage: boolean;
  scenes: Scene[];
  threads: Thread[];
  links: Link[];
  characters: Character[];
  dialogues: Dialogue[];
  updatedAt: number;
}

export interface AppData {
  version: 1;
  projects: Project[];
  currentProjectId: ID | null;
}
