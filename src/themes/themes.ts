/**
 * テーマ定義。
 *
 * 見た目はすべて CSS カスタムプロパティ（デザイントークン）で決まるので、
 * 新しいテーマはこの配列にオブジェクトを1つ追加するだけで設定画面に表示される。
 * タイルの CSS はトークンだけを参照し、色を直接書かないこと。
 */
export type ThemeTokens = Record<`--${string}`, string>;

export interface ThemeDef {
  id: string;
  name: string;
  description: string;
  scheme: 'dark' | 'light';
  /** 既定の壁紙（wallpapers の id） */
  wallpaper: string;
  tokens: ThemeTokens;
}

/** 全テーマ共通の基本トークン（テーマ側で上書き可能） */
export const BASE_TOKENS: ThemeTokens = {
  '--font-sans': '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Segoe UI", "Yu Gothic UI", Meiryo, sans-serif',
  '--font-display': '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Segoe UI", sans-serif',
  '--font-rounded': '"SF Pro Rounded", "Hiragino Maru Gothic ProN", "Hiragino Sans", "M PLUS Rounded 1c", "Noto Sans JP", sans-serif',
  '--radius-tile': '26px',
  '--radius-md': '16px',
  '--radius-sm': '10px',
  '--tile-gap': '14px',
  '--tile-padding': 'clamp(10px, 5cqmin, 22px)',
  '--tile-blur': '22px',
  '--ease-out': 'cubic-bezier(.2,.8,.2,1)',
  '--danger': '#ff5d6c',
  '--warn': '#ffb547',
  '--ok': '#3ddc97',
  '--info': '#5ab4ff',
  '--sun': '#ff6b7a',
  '--sat': '#5aa8ff',
};

export const THEMES: ThemeDef[] = [
  {
    id: 'midnight',
    name: 'ミッドナイト',
    description: '深い夜空にすりガラスのタイル。壁掛けに最適な標準テーマ',
    scheme: 'dark',
    wallpaper: 'aurora',
    tokens: {
      '--bg': '#070a14',
      '--tile-bg': 'rgba(22, 28, 48, 0.55)',
      '--tile-bg-strong': 'rgba(30, 37, 62, 0.82)',
      '--tile-border': 'rgba(255, 255, 255, 0.09)',
      '--tile-shadow': '0 18px 40px -18px rgba(0, 0, 0, 0.65)',
      '--tile-highlight': 'linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 40%)',
      '--text-1': '#f4f6ff',
      '--text-2': 'rgba(228, 232, 255, 0.72)',
      '--text-3': 'rgba(210, 216, 255, 0.48)',
      '--line': 'rgba(255, 255, 255, 0.08)',
      '--chip-bg': 'rgba(255, 255, 255, 0.08)',
      '--accent': '#8b7bff',
      '--accent-2': '#3fd0ff',
      '--accent-contrast': '#ffffff',
      '--overlay': 'rgba(4, 6, 14, 0.62)',
      '--sheet-bg': 'rgba(18, 22, 38, 0.92)',
      '--input-bg': 'rgba(255, 255, 255, 0.06)',
    },
  },
  {
    id: 'daylight',
    name: 'デイライト',
    description: '明るい部屋になじむ、やわらかいパステルのガラス',
    scheme: 'light',
    wallpaper: 'morning',
    tokens: {
      '--bg': '#eef1f8',
      '--tile-bg': 'rgba(255, 255, 255, 0.62)',
      '--tile-bg-strong': 'rgba(255, 255, 255, 0.9)',
      '--tile-border': 'rgba(255, 255, 255, 0.75)',
      '--tile-shadow': '0 16px 36px -20px rgba(40, 52, 90, 0.35)',
      '--tile-highlight': 'linear-gradient(160deg, rgba(255,255,255,0.7), rgba(255,255,255,0) 45%)',
      '--text-1': '#151a2d',
      '--text-2': 'rgba(21, 26, 45, 0.72)',
      '--text-3': 'rgba(21, 26, 45, 0.48)',
      '--line': 'rgba(21, 26, 45, 0.08)',
      '--chip-bg': 'rgba(21, 26, 45, 0.06)',
      '--accent': '#5b4cf0',
      '--accent-2': '#0094d6',
      '--accent-contrast': '#ffffff',
      '--overlay': 'rgba(220, 226, 240, 0.6)',
      '--sheet-bg': 'rgba(250, 251, 255, 0.95)',
      '--input-bg': 'rgba(21, 26, 45, 0.05)',
      '--sun': '#e5374a',
      '--sat': '#1f73e0',
    },
  },
  {
    id: 'tigers',
    name: 'タイガース',
    description: '黒と黄色のストライプ。虎党のためのテーマ',
    scheme: 'dark',
    wallpaper: 'stripe',
    tokens: {
      '--bg': '#0b0b0b',
      '--tile-bg': 'rgba(18, 18, 18, 0.72)',
      '--tile-bg-strong': 'rgba(24, 24, 24, 0.92)',
      '--tile-border': 'rgba(255, 214, 0, 0.18)',
      '--tile-shadow': '0 18px 40px -18px rgba(0, 0, 0, 0.8)',
      '--tile-highlight': 'linear-gradient(160deg, rgba(255,214,0,0.10), rgba(255,214,0,0) 40%)',
      '--text-1': '#fffbea',
      '--text-2': 'rgba(255, 246, 214, 0.74)',
      '--text-3': 'rgba(255, 238, 180, 0.5)',
      '--line': 'rgba(255, 214, 0, 0.12)',
      '--chip-bg': 'rgba(255, 214, 0, 0.1)',
      '--accent': '#ffd400',
      '--accent-2': '#ffffff',
      '--accent-contrast': '#111111',
      '--overlay': 'rgba(0, 0, 0, 0.66)',
      '--sheet-bg': 'rgba(16, 16, 16, 0.95)',
      '--input-bg': 'rgba(255, 255, 255, 0.06)',
    },
  },
  {
    id: 'forest',
    name: 'フォレスト',
    description: '落ち着いた深緑と木漏れ日のようなアクセント',
    scheme: 'dark',
    wallpaper: 'forest',
    tokens: {
      '--bg': '#07120e',
      '--tile-bg': 'rgba(16, 36, 28, 0.55)',
      '--tile-bg-strong': 'rgba(20, 44, 34, 0.88)',
      '--tile-border': 'rgba(190, 255, 220, 0.1)',
      '--tile-shadow': '0 18px 40px -18px rgba(0, 0, 0, 0.7)',
      '--tile-highlight': 'linear-gradient(160deg, rgba(220,255,235,0.10), rgba(255,255,255,0) 40%)',
      '--text-1': '#effff6',
      '--text-2': 'rgba(222, 255, 238, 0.72)',
      '--text-3': 'rgba(200, 240, 220, 0.48)',
      '--line': 'rgba(255, 255, 255, 0.08)',
      '--chip-bg': 'rgba(255, 255, 255, 0.08)',
      '--accent': '#7ee2a8',
      '--accent-2': '#ffd27a',
      '--accent-contrast': '#062015',
      '--overlay': 'rgba(3, 10, 7, 0.62)',
      '--sheet-bg': 'rgba(12, 28, 22, 0.94)',
      '--input-bg': 'rgba(255, 255, 255, 0.06)',
    },
  },
  {
    id: 'sakura',
    name: 'サクラ',
    description: '桜色のやさしい明るいテーマ',
    scheme: 'light',
    wallpaper: 'sakura',
    tokens: {
      '--bg': '#fff3f6',
      '--tile-bg': 'rgba(255, 255, 255, 0.6)',
      '--tile-bg-strong': 'rgba(255, 255, 255, 0.9)',
      '--tile-border': 'rgba(255, 255, 255, 0.8)',
      '--tile-shadow': '0 16px 36px -20px rgba(150, 60, 90, 0.35)',
      '--tile-highlight': 'linear-gradient(160deg, rgba(255,255,255,0.7), rgba(255,255,255,0) 45%)',
      '--text-1': '#3a1d29',
      '--text-2': 'rgba(58, 29, 41, 0.72)',
      '--text-3': 'rgba(58, 29, 41, 0.48)',
      '--line': 'rgba(58, 29, 41, 0.08)',
      '--chip-bg': 'rgba(58, 29, 41, 0.06)',
      '--accent': '#e0457b',
      '--accent-2': '#8a5cf6',
      '--accent-contrast': '#ffffff',
      '--overlay': 'rgba(255, 230, 238, 0.6)',
      '--sheet-bg': 'rgba(255, 250, 252, 0.96)',
      '--input-bg': 'rgba(58, 29, 41, 0.05)',
      '--sun': '#d92d4a',
      '--sat': '#2f6fd6',
    },
  },
];

export interface WallpaperDef {
  id: string;
  name: string;
  css: string;
}

export const WALLPAPERS: WallpaperDef[] = [
  {
    id: 'aurora',
    name: 'オーロラ',
    css: 'radial-gradient(1200px 800px at 12% 8%, rgba(110, 76, 255, 0.45), transparent 60%), radial-gradient(900px 700px at 92% 12%, rgba(0, 180, 255, 0.32), transparent 60%), radial-gradient(1000px 800px at 60% 110%, rgba(0, 220, 170, 0.22), transparent 60%), linear-gradient(180deg, #080b18, #05070f)',
  },
  {
    id: 'morning',
    name: 'モーニング',
    css: 'radial-gradient(1000px 700px at 10% 0%, rgba(255, 200, 220, 0.75), transparent 60%), radial-gradient(900px 700px at 100% 10%, rgba(170, 210, 255, 0.85), transparent 60%), radial-gradient(900px 700px at 50% 110%, rgba(200, 255, 230, 0.7), transparent 60%), linear-gradient(180deg, #f4f6fc, #e9edf7)',
  },
  {
    id: 'sunset',
    name: 'サンセット',
    css: 'radial-gradient(1100px 800px at 0% 100%, rgba(255, 120, 80, 0.45), transparent 60%), radial-gradient(1000px 700px at 100% 0%, rgba(160, 60, 200, 0.45), transparent 60%), linear-gradient(160deg, #1a0e24, #2a0f1c)',
  },
  {
    id: 'ocean',
    name: 'オーシャン',
    css: 'radial-gradient(1100px 800px at 20% 0%, rgba(0, 140, 255, 0.4), transparent 60%), radial-gradient(900px 700px at 100% 100%, rgba(0, 230, 200, 0.3), transparent 60%), linear-gradient(180deg, #031225, #020a16)',
  },
  {
    id: 'forest',
    name: 'フォレスト',
    css: 'radial-gradient(1000px 700px at 0% 0%, rgba(60, 200, 120, 0.35), transparent 60%), radial-gradient(900px 700px at 100% 100%, rgba(255, 200, 100, 0.18), transparent 60%), linear-gradient(180deg, #06140e, #030b08)',
  },
  {
    id: 'sakura',
    name: 'サクラ',
    css: 'radial-gradient(1000px 700px at 0% 0%, rgba(255, 170, 200, 0.7), transparent 60%), radial-gradient(900px 700px at 100% 100%, rgba(220, 190, 255, 0.6), transparent 60%), linear-gradient(180deg, #fff5f8, #fde9f0)',
  },
  {
    id: 'stripe',
    name: 'タイガース',
    css: 'radial-gradient(900px 600px at 85% 0%, rgba(255, 212, 0, 0.22), transparent 60%), repeating-linear-gradient(100deg, rgba(255,212,0,0.07) 0 14px, transparent 14px 64px), linear-gradient(180deg, #0d0d0d, #050505)',
  },
  { id: 'mono', name: 'モノトーン', css: 'linear-gradient(180deg, #16181d, #0c0d10)' },
];

export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

/** テーマ id「auto」は OS のダーク/ライト設定に合わせる */
export function resolveTheme(id: string, prefersDark: boolean): ThemeDef {
  if (id === 'auto') return themeById(prefersDark ? 'midnight' : 'daylight');
  return themeById(id);
}

export function applyTheme(theme: ThemeDef, wallpaperId: string): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries({ ...BASE_TOKENS, ...theme.tokens })) root.style.setProperty(k, v);
  const wp = WALLPAPERS.find((w) => w.id === (wallpaperId === 'theme' ? theme.wallpaper : wallpaperId)) ?? WALLPAPERS[0];
  root.style.setProperty('--wallpaper', wp.css);
  root.dataset.theme = theme.id;
  root.dataset.scheme = theme.scheme;
  root.style.colorScheme = theme.scheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.tokens['--bg'] ?? '#000');
}

/** タイル個別のアクセントカラー（タイル設定で選択） */
export const ACCENTS: { id: string; name: string; value: string }[] = [
  { id: 'theme', name: 'テーマ', value: '' },
  { id: 'violet', name: 'バイオレット', value: '#8b7bff' },
  { id: 'sky', name: 'スカイ', value: '#3fb8ff' },
  { id: 'mint', name: 'ミント', value: '#3ddc97' },
  { id: 'sun', name: 'サン', value: '#ffc23d' },
  { id: 'coral', name: 'コーラル', value: '#ff7a6b' },
  { id: 'pink', name: 'ピンク', value: '#ff6fb5' },
  { id: 'tigers', name: 'タイガース', value: '#ffd400' },
];
