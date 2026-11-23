import { createElement, lazy, Suspense } from 'react';
import { DEFAULT_SETTINGS } from '../../shared/defaults';
import type { SizeLimits } from '../grid/layout';
import { ShoppingTile, TaskBoardTile, MemoTile } from './BoardTiles';
import { ClockTile } from './ClockTile';
import { CodmonTile } from './CodmonTile';
import { EventsTile } from './EventsTile';
import { AnniversaryTile, CalendarTile, GarbageTile, PhotoTile, TimerTile, WarningTile } from './ExtraTiles';
import { NewsTile, TigersTile } from './FeedTiles';
import { FlyerTile } from './FlyerTile';
import { FunFactTile } from './FunFactTile';
import { HolidayTile } from './HolidayTile';
import { KidsQuizTile, TriviaTile } from './QuizTiles';
import type { TileComponentProps, TileDefinition } from './types';
import { WeatherTile } from './WeatherTile';
import { WifiTile } from './WifiTile';

// 地図ライブラリ（Leaflet）は雨雲レーダーを使うときだけ読み込む
const RadarLazy = lazy(() => import('./RadarTile'));
const RadarTile = (p: TileComponentProps) => createElement(Suspense, { fallback: null }, createElement(RadarLazy, p));

const newsFeedOptions = [
  { value: 'enabled', label: 'まとめ（有効なフィードすべて）' },
  ...DEFAULT_SETTINGS.news.feeds.map((f) => ({ value: f.id, label: f.name })),
];

/**
 * タイルの一覧。新しいタイルを作るときはコンポーネントを書いてここに1件追加するだけでよい。
 */
export const TILE_DEFINITIONS: TileDefinition[] = [
  // ---- 指定タイル ----
  {
    type: 'clock',
    name: '時計',
    description: 'デジタル／アナログ時計と日付・祝日',
    icon: '🕐',
    category: 'basic',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 1, h: 1 },
    component: ClockTile,
    defaultProps: { style: 'auto', seconds: false, date: true },
    options: [
      {
        key: 'style',
        label: '表示スタイル',
        type: 'select',
        options: [
          { value: 'auto', label: '自動' },
          { value: 'digital', label: 'デジタル' },
          { value: 'analog', label: 'アナログ' },
        ],
      },
      { key: 'seconds', label: '秒を表示', type: 'toggle' },
      { key: 'date', label: '日付を表示', type: 'toggle' },
    ],
  },
  {
    type: 'weather',
    name: '天気',
    description: '現在の天気・1時間ごと・週間予報（Open-Meteo）',
    icon: '⛅',
    category: 'basic',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 1, h: 1 },
    component: WeatherTile,
    defaultProps: { view: 'auto' },
    options: [
      {
        key: 'view',
        label: '表示内容',
        type: 'select',
        options: [
          { value: 'auto', label: '自動' },
          { value: 'now', label: '現在' },
          { value: 'hourly', label: '1時間ごと' },
          { value: 'weekly', label: '週間' },
        ],
        help: '「自動」はタイルが大きいと週間予報も表示します',
      },
      { key: 'name', label: '地点名（空欄なら設定の地域）', type: 'text', placeholder: '例: 甲子園' },
      { key: 'lat', label: '緯度（任意）', type: 'number', step: 0.0001 },
      { key: 'lon', label: '経度（任意）', type: 'number', step: 0.0001 },
    ],
  },
  {
    type: 'tigers',
    name: '阪神タイガース',
    description: '公式サイト・ニュース・SNS（RSS）の最新情報',
    icon: '🐯',
    category: 'info',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 1 },
    component: TigersTile,
    defaultProps: { source: 'all', links: true },
    options: [
      {
        key: 'source',
        label: '表示するニュース',
        type: 'select',
        options: [
          { value: 'all', label: 'すべて' },
          { value: 'official', label: '公式のみ' },
        ],
      },
      { key: 'links', label: '公式SNSボタンを表示', type: 'toggle' },
    ],
  },
  {
    type: 'holiday',
    name: '次の祝日',
    description: '次の祝日まであと何日？連休もお知らせ',
    icon: '🎌',
    category: 'basic',
    defaultSize: { w: 2, h: 2 },
    minSize: { w: 1, h: 1 },
    component: HolidayTile,
  },
  {
    type: 'wifi',
    name: 'WiFi QRコード',
    description: 'カメラで読み取るだけでWiFiに接続',
    icon: '📶',
    category: 'family',
    defaultSize: { w: 2, h: 2 },
    minSize: { w: 1, h: 1 },
    component: WifiTile,
    defaultProps: { showPassword: true },
    options: [{ key: 'showPassword', label: 'パスワード表示ボタン', type: 'toggle' }],
  },
  {
    type: 'trivia',
    name: '常識クイズ',
    description: 'ためになる常識クイズを1時間ごとに出題（400問）',
    icon: '💡',
    category: 'info',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 1 },
    component: TriviaTile,
    defaultProps: { autoReveal: false },
    options: [{ key: 'autoReveal', label: '残り15分で自動的に答えを表示', type: 'toggle' }],
  },
  {
    type: 'funfact',
    name: 'トリビア',
    description: '「へぇ〜！」となる雑学や言葉の由来（400個）',
    icon: '🤔',
    category: 'info',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 1, h: 1 },
    component: FunFactTile,
    defaultProps: { interval: 30, reveal: 'tap' },
    options: [
      { key: 'interval', label: '自動で切り替える間隔（分）', type: 'number', min: 1, max: 1440 },
      {
        key: 'reveal',
        label: '答えの表示',
        type: 'select',
        options: [
          { value: 'tap', label: 'タップで表示' },
          { value: 'always', label: '最初から表示' },
        ],
      },
    ],
  },
  {
    type: 'kidsQuiz',
    name: 'こどもクイズ',
    description: '2〜6さい向け。えらんでタッチ！（400問）',
    icon: '🧸',
    category: 'kids',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 2, h: 2 },
    component: KidsQuizTile,
    defaultProps: { sound: true, autoNext: true },
    options: [
      { key: 'sound', label: '効果音', type: 'toggle' },
      { key: 'autoNext', label: '正解したら自動で次の問題へ', type: 'toggle' },
    ],
  },
  {
    type: 'flyer',
    name: '今週のチラシ',
    description: 'よく行くお店のチラシを自動で表示（トクバイ）',
    icon: '🛒',
    category: 'family',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 2, h: 2 },
    component: FlyerTile,
    defaultProps: { interval: 12 },
    options: [{ key: 'interval', label: '切り替え間隔（秒）', type: 'number', min: 4, max: 120 }],
  },
  {
    type: 'timetree',
    name: '予定（TimeTree）',
    description: 'TimeTree の予定を今日から1か月分表示',
    icon: '📅',
    category: 'family',
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 2, h: 1 },
    component: EventsTile,
    options: [{ key: 'days', label: '表示する日数（空欄なら設定値）', type: 'number', min: 1, max: 92 }],
  },
  {
    type: 'tasks',
    name: 'タスクボード',
    description: 'やらなきゃいけないことを箇条書きで共有',
    icon: '✅',
    category: 'family',
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 1, h: 1 },
    component: TaskBoardTile,
    defaultProps: { listId: 'tasks', title: '' },
    options: [
      { key: 'title', label: 'タイトル', type: 'text', placeholder: 'タスクボード' },
      { key: 'listId', label: 'リストID（別のリストにしたい場合に変更）', type: 'text', placeholder: 'tasks', help: '同じIDのタイル同士は内容を共有します' },
    ],
  },

  {
    type: 'codmon',
    name: 'コドモン',
    description: '連絡帳の提出・持ち物チェック、登園/お迎え時刻、コドモンを開く',
    icon: '🏫',
    category: 'kids',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 1, h: 1 },
    component: CodmonTile,
    defaultProps: { childName: '', dropTime: '8:30', pickupTime: '17:30', checks: '連絡帳を提出, 検温, 持ち物の準備', skipHolidays: true, url: '' },
    options: [
      { key: 'childName', label: 'お子さまの名前（任意）', type: 'text', placeholder: '例: はなこ' },
      { key: 'dropTime', label: '登園時刻', type: 'text', placeholder: '8:30' },
      { key: 'pickupTime', label: 'お迎え時刻', type: 'text', placeholder: '17:30' },
      { key: 'checks', label: '毎朝のチェック項目（カンマ区切り）', type: 'text', placeholder: '連絡帳を提出, 検温, 持ち物の準備', help: 'チェックは家族で共有され、毎日リセットされます' },
      { key: 'skipHolidays', label: '土日祝は「おやすみ」表示', type: 'toggle' },
      { key: 'url', label: '開くURL（空欄なら保護者向けWeb版）', type: 'text', placeholder: 'https://parents.codmon.com/' },
    ],
  },

  // ---- 追加タイル（10種） ----
  {
    type: 'calendar',
    name: 'カレンダー',
    description: '月間カレンダー（祝日・予定・ゴミの日）',
    icon: '🗓️',
    category: 'basic',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    component: CalendarTile,
    defaultProps: { garbage: true, events: true },
    options: [
      { key: 'events', label: '予定がある日に印', type: 'toggle' },
      { key: 'garbage', label: 'ゴミの日を表示（大きいとき）', type: 'toggle' },
    ],
  },
  {
    type: 'garbage',
    name: 'ゴミ出し',
    description: '今日・明日のゴミの種類をお知らせ',
    icon: '🗑️',
    category: 'family',
    defaultSize: { w: 2, h: 2 },
    minSize: { w: 1, h: 1 },
    component: GarbageTile,
  },
  {
    type: 'memo',
    name: '伝言板',
    description: '家族への伝言を付せんで共有',
    icon: '📝',
    category: 'family',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 1, h: 1 },
    component: MemoTile,
  },
  {
    type: 'shopping',
    name: '買い物リスト',
    description: '家族みんなで使える買い物メモ',
    icon: '🧺',
    category: 'family',
    defaultSize: { w: 2, h: 4 },
    minSize: { w: 1, h: 1 },
    component: ShoppingTile,
    defaultProps: { listId: 'shopping', title: '' },
    options: [
      { key: 'title', label: 'タイトル', type: 'text', placeholder: '買い物リスト' },
      { key: 'listId', label: 'リストID', type: 'text', placeholder: 'shopping' },
    ],
  },
  {
    type: 'timer',
    name: 'タイマー',
    description: 'キッチンタイマー・歯みがきタイマーに',
    icon: '⏱️',
    category: 'tools',
    defaultSize: { w: 2, h: 2 },
    minSize: { w: 1, h: 1 },
    component: TimerTile,
    defaultProps: { presets: '1,3,5,10,15,30' },
    options: [{ key: 'presets', label: 'ボタンの時間（分・カンマ区切り）', type: 'text', placeholder: '1,3,5,10' }],
  },
  {
    type: 'news',
    name: 'ニュース',
    description: '最新ニュースの見出し（RSS）',
    icon: '📰',
    category: 'info',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 2, h: 1 },
    component: NewsTile,
    defaultProps: { feed: 'yahoo-top' },
    options: [{ key: 'feed', label: 'ジャンル', type: 'select', options: newsFeedOptions }],
  },
  {
    type: 'radar',
    name: '雨雲レーダー',
    description: '気象庁の雨雲の動き（過去1時間＋予報）',
    icon: '🌧️',
    category: 'info',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 2, h: 2 },
    component: RadarTile,
    bare: true,
    defaultProps: { zoom: 9, animate: true, forecast: true },
    options: [
      { key: 'zoom', label: '地図の縮尺（5=広域 〜 10=詳細）', type: 'number', min: 5, max: 10 },
      { key: 'animate', label: '動きをアニメーション', type: 'toggle' },
      { key: 'forecast', label: '予報（1時間先まで）も表示', type: 'toggle' },
    ],
  },
  {
    type: 'warning',
    name: '警報・注意報',
    description: 'お住まいの地域の気象警報（気象庁）',
    icon: '⚠️',
    category: 'info',
    defaultSize: { w: 2, h: 2 },
    minSize: { w: 1, h: 1 },
    component: WarningTile,
  },
  {
    type: 'anniversary',
    name: '記念日カウントダウン',
    description: '誕生日・記念日まであと何日',
    icon: '🎂',
    category: 'family',
    defaultSize: { w: 2, h: 2 },
    minSize: { w: 1, h: 1 },
    component: AnniversaryTile,
  },
  {
    type: 'photo',
    name: 'フォトフレーム',
    description: 'PC のフォルダの写真をスライドショー',
    icon: '🖼️',
    category: 'family',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 1, h: 1 },
    component: PhotoTile,
    bare: true,
    defaultProps: { fit: 'cover', shuffle: true },
    options: [
      {
        key: 'fit',
        label: '表示方法',
        type: 'select',
        options: [
          { value: 'cover', label: 'タイルいっぱい' },
          { value: 'contain', label: '写真全体' },
        ],
      },
      { key: 'shuffle', label: 'シャッフル', type: 'toggle' },
      { key: 'interval', label: '切り替え間隔（秒・空欄なら設定値）', type: 'number', min: 3, max: 3600 },
    ],
  },
];

const BY_TYPE = new Map(TILE_DEFINITIONS.map((d) => [d.type, d]));

export const getTileDef = (type: string) => BY_TYPE.get(type);

export function limitsOf(type: string): SizeLimits {
  const def = BY_TYPE.get(type);
  return { minSize: def?.minSize ?? { w: 1, h: 1 }, maxSize: def?.maxSize };
}
