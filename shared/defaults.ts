import type { AppSettings, BoardsState, FeedSource, LayoutState } from './types';

const yahoo = (id: string, name: string, cat: string, enabled = false): FeedSource => ({
  id,
  name,
  url: `https://news.yahoo.co.jp/rss/topics/${cat}.xml`,
  enabled,
});

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  appearance: {
    theme: 'midnight',
    wallpaper: 'theme',
    nightDim: false,
    nightStart: '22:00',
    nightEnd: '06:00',
    keepAwake: true,
  },
  location: {
    name: '大阪市',
    lat: 34.6937,
    lon: 135.5023,
    jmaOffice: '270000',
    jmaArea: '2710000',
    jmaAreaName: '大阪市',
  },
  wifi: {
    ssid: '',
    password: '',
    encryption: 'WPA',
    hidden: false,
  },
  tigers: {
    officialSite: true,
    feeds: [
      {
        id: 'gnews-tigers',
        name: 'Googleニュース',
        url: 'https://news.google.com/rss/search?q=%E9%98%AA%E7%A5%9E%E3%82%BF%E3%82%A4%E3%82%AC%E3%83%BC%E3%82%B9&hl=ja&gl=JP&ceid=JP:ja',
        enabled: true,
      },
    ],
    rsshubBase: '',
    xAccount: 'TigersDreamlink',
    instagramAccount: 'hanshintigers_official',
  },
  news: {
    feeds: [
      yahoo('yahoo-top', '主要', 'top-picks', true),
      yahoo('yahoo-domestic', '国内', 'domestic'),
      yahoo('yahoo-world', '国際', 'world'),
      yahoo('yahoo-business', '経済', 'business'),
      yahoo('yahoo-entertainment', 'エンタメ', 'entertainment'),
      yahoo('yahoo-sports', 'スポーツ', 'sports'),
      yahoo('yahoo-it', 'IT', 'it'),
      yahoo('yahoo-science', '科学', 'science'),
      yahoo('yahoo-local', '地域', 'local'),
    ],
  },
  flyers: {
    stores: [],
  },
  calendar: {
    timetreeEmail: '',
    timetreePassword: '',
    timetreeCalendarIds: [],
    icsUrls: [],
    days: 31,
  },
  garbage: {
    rules: [
      { id: 'burnable', name: '燃えるごみ', icon: '🔥', color: '#ff7a59', weekdays: [1, 4], nths: [] },
      { id: 'plastic', name: 'プラスチック', icon: '♻️', color: '#4cc9f0', weekdays: [3], nths: [] },
      { id: 'cans', name: '缶・びん・ペット', icon: '🥫', color: '#80ed99', weekdays: [5], nths: [2, 4] },
    ],
  },
  anniversaries: {
    items: [{ id: 'xmas', name: 'クリスマス', date: '0000-12-25', kind: 'event', icon: '🎄' }],
  },
  lock: {
    enabled: false,
  },
  photos: {
    dir: '',
    intervalSec: 15,
  },
};

export const EMPTY_LAYOUT: LayoutState = { profiles: {}, updatedAt: 0 };

export const EMPTY_BOARDS: BoardsState = { memos: [], lists: {}, updatedAt: 0 };

type Plain = Record<string, unknown>;
const isPlainObject = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * 既定値に保存値を深くマージする。将来設定項目が増えても古い設定ファイルを読み込めるようにする。
 * 配列は保存値で丸ごと置き換える。型が異なる値は既定値を採用する。
 */
export function mergeDeep<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    if (override === undefined || override === null) return base;
    if (Array.isArray(base)) return (Array.isArray(override) ? override : base) as T;
    if (typeof base === typeof override) return override as T;
    return base;
  }
  const out: Plain = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = key in base ? mergeDeep((base as Plain)[key], value) : value;
  }
  return out as T;
}

export function normalizeSettings(raw: unknown): AppSettings {
  return mergeDeep(DEFAULT_SETTINGS, raw);
}

export function newId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}
