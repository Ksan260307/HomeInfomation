/**
 * クライアントとサーバーで共有する型定義。
 * 設定・レイアウト・共有ボードはすべて PC ローカルの data/ ディレクトリに JSON で保存される。
 */

// ---------------------------------------------------------------------------
// レイアウト
// ---------------------------------------------------------------------------

export interface TileInstance {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** タイルごとの表示オプション（時計のスタイルなど） */
  props?: Record<string, unknown>;
}

export interface Page {
  id: string;
  tiles: TileInstance[];
}

export interface LayoutProfile {
  cols: number;
  rows: number;
  pages: Page[];
}

/** 端末の向き・サイズごとにレイアウトを保持する（Android のホーム画面と同じ考え方） */
export type ProfileId = 'tablet-landscape' | 'tablet-portrait' | 'phone';

export interface LayoutState {
  profiles: Partial<Record<ProfileId, LayoutProfile>>;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface GarbageRule {
  id: string;
  name: string;
  /** 表示用の絵文字 */
  icon: string;
  color: string;
  /** 0=日 ... 6=土 */
  weekdays: number[];
  /** 第n週の指定（空なら毎週）。1〜5 */
  nths: number[];
}

export interface Anniversary {
  id: string;
  name: string;
  /** YYYY-MM-DD（年不明の場合は 0000-MM-DD） */
  date: string;
  kind: 'birthday' | 'anniversary' | 'event';
  icon: string;
}

export interface FlyerStore {
  id: string;
  name: string;
  /** トクバイの店舗ページなどのURL */
  url: string;
}

export interface AppSettings {
  version: 1;
  appearance: {
    theme: string;
    wallpaper: string;
    /** 夜間に画面を暗くする */
    nightDim: boolean;
    nightStart: string;
    nightEnd: string;
    /** 画面スリープを防ぐ（Wake Lock API） */
    keepAwake: boolean;
  };
  location: {
    name: string;
    lat: number;
    lon: number;
    /** 気象庁の府県予報区コード（例: 270000 = 大阪府） */
    jmaOffice: string;
    /** 気象庁の市区町村コード（例: 2710000 = 大阪市） */
    jmaArea: string;
    jmaAreaName: string;
  };
  wifi: {
    ssid: string;
    password: string;
    encryption: 'WPA' | 'WEP' | 'nopass';
    hidden: boolean;
  };
  tigers: {
    /** 阪神タイガース公式サイトのニュースを取得する */
    officialSite: boolean;
    feeds: FeedSource[];
    /** セルフホストした RSSHub のURL（X / Instagram を RSS 化する場合） */
    rsshubBase: string;
    xAccount: string;
    instagramAccount: string;
  };
  news: {
    feeds: FeedSource[];
  };
  flyers: {
    stores: FlyerStore[];
  };
  calendar: {
    /** TimeTree のログインメール（パスワードはサーバーのみが保持し、クライアントへは返さない） */
    timetreeEmail: string;
    timetreePassword: string;
    /** 表示するカレンダーID（空なら全て） */
    timetreeCalendarIds: string[];
    /** 追加の iCal(ICS) URL（Google カレンダーの非公開URLなど） */
    icsUrls: string[];
    days: number;
  };
  garbage: {
    rules: GarbageRule[];
  };
  anniversaries: {
    items: Anniversary[];
  };
  /** メイン画面のロック（リモコンから切り替え。編集・設定を禁止する） */
  lock: {
    enabled: boolean;
  };
  photos: {
    /** 写真フォルダのパス（空なら data/photos） */
    dir: string;
    intervalSec: number;
  };
}

/** クライアントへ返す設定。秘匿情報は伏せる */
export type PublicSettings = AppSettings & {
  calendar: AppSettings['calendar'] & { timetreePasswordSet: boolean };
};

// ---------------------------------------------------------------------------
// 共有ボード（伝言板・買い物リスト・タスクボード）
// ---------------------------------------------------------------------------

export interface MemoNote {
  id: string;
  text: string;
  color: string;
  author?: string;
  createdAt: number;
}

export interface ListItem {
  id: string;
  text: string;
  done: boolean;
  important?: boolean;
  createdAt: number;
  doneAt?: number;
}

export interface BoardsState {
  memos: MemoNote[];
  lists: Record<string, ListItem[]>;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// エクスポート / インポート
// ---------------------------------------------------------------------------

export interface ExportBundle {
  app: 'home-information';
  formatVersion: 1;
  exportedAt: string;
  includesSecrets: boolean;
  settings: AppSettings;
  layout: LayoutState;
  boards: BoardsState;
}

// ---------------------------------------------------------------------------
// API レスポンス
// ---------------------------------------------------------------------------

export interface FeedItem {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: number | null;
  image?: string;
}

export interface FeedResponse {
  items: FeedItem[];
  errors: string[];
  fetchedAt: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  location?: string;
  calendar: string;
  color?: string;
}

export interface CalendarResponse {
  events: CalendarEvent[];
  errors: string[];
  fetchedAt: number;
}

export interface FlyerItem {
  thumb: string;
  full: string;
  link: string;
}

export interface FlyerStoreResult {
  id: string;
  name: string;
  url: string;
  flyers: FlyerItem[];
  error?: string;
}

export interface FlyerResponse {
  stores: FlyerStoreResult[];
  fetchedAt: number;
}

export interface WarningItem {
  code: string;
  name: string;
  /** 20=注意報, 30=警報, 40=危険警報, 50=特別警報 */
  level: number;
  status: string;
}

export interface WarningResponse {
  areaName: string;
  reportDatetime: string | null;
  headline: string;
  items: WarningItem[];
  fetchedAt: number;
}

// ---------------------------------------------------------------------------
// リモコン（スマホから表示端末を操作）
// ---------------------------------------------------------------------------

export interface DisplayInfo {
  id: string;
  name: string;
  profile: string;
  page: number;
  pageCount: number;
  /** 各ページのタイルのアイコン（リモコンでページを見分けるため） */
  pages: string[];
  dim: boolean;
  lastSeen: number;
  connected: boolean;
}

export type RemoteCommand =
  | { type: 'goto'; page: number }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'reload' }
  | { type: 'dim' }
  | { type: 'undim' }
  | { type: 'identify' }
  | { type: 'sync' };
