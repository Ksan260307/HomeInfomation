import type { Anniversary, GarbageRule } from '../../shared/types';
import { daysBetween, toYmd } from './holidays';

// ---------------------------------------------------------------------------
// 乱数（シード付き）— 全端末で同じ「1時間ごとのクイズ」を出すため
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 1時間ごとに切り替わるインデックス。
 * 全件を一巡するまで同じ問題が出ないよう、周回ごとにシャッフルした順番を使う。
 */
export function periodIndex(now: number, total: number, periodMs: number, salt = 0, step = 0): { index: number; nextChangeAt: number } {
  const offset = 9 * 3600_000; // 日本時間の区切りに合わせる
  const period = Math.floor((now + offset) / periodMs);
  const slot = period + step; // step = 「次の問題」を押した回数
  const cycle = Math.floor(slot / total);
  const order = seededShuffle(
    Array.from({ length: total }, (_, i) => i),
    cycle * 7919 + salt,
  );
  const nextChangeAt = (period + 1) * periodMs - offset;
  return { index: order[((slot % total) + total) % total], nextChangeAt };
}

export function hourlyIndex(now: number, total: number, salt = 0, step = 0): { index: number; nextChangeAt: number } {
  return periodIndex(now, total, 3600_000, salt, step);
}

// ---------------------------------------------------------------------------
// WiFi QR コード
// ---------------------------------------------------------------------------

const escapeWifi = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');

export function wifiQrPayload(ssid: string, password: string, encryption: 'WPA' | 'WEP' | 'nopass', hidden: boolean): string {
  const parts = [`T:${encryption}`, `S:${escapeWifi(ssid)}`];
  if (encryption !== 'nopass') parts.push(`P:${escapeWifi(password)}`);
  if (hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

// ---------------------------------------------------------------------------
// ゴミ出し
// ---------------------------------------------------------------------------

export const nthWeekOfMonth = (date: Date) => Math.floor((date.getDate() - 1) / 7) + 1;

export function garbageOn(date: Date, rules: GarbageRule[]): GarbageRule[] {
  const day = date.getDay();
  const nth = nthWeekOfMonth(date);
  return rules.filter((r) => r.weekdays.includes(day) && (r.nths.length === 0 || r.nths.includes(nth)));
}

// ---------------------------------------------------------------------------
// 記念日
// ---------------------------------------------------------------------------

export interface AnniversaryOccurrence {
  item: Anniversary;
  date: string;
  daysLeft: number;
  /** 誕生日なら迎える年齢、記念日なら周年 */
  years: number | null;
}

export function nextAnniversary(item: Anniversary, today: Date): AnniversaryOccurrence | null {
  const m = item.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, ys, ms, ds] = m;
  const baseYear = Number(ys);
  const month = Number(ms);
  const day = Number(ds);
  const todayKey = toYmd(today);
  const dateFor = (y: number) => {
    const last = new Date(y, month, 0).getDate();
    return toYmd(new Date(y, month - 1, Math.min(day, last)));
  };

  if (item.kind === 'event' && baseYear >= 1000) {
    // 一度きりのイベント
    const daysLeft = daysBetween(todayKey, item.date);
    return daysLeft >= 0 ? { item, date: item.date, daysLeft, years: null } : null;
  }
  let y = today.getFullYear();
  let date = dateFor(y);
  if (date < todayKey) date = dateFor(++y);
  return { item, date, daysLeft: daysBetween(todayKey, date), years: baseYear >= 1000 ? y - baseYear : null };
}

export function upcomingAnniversaries(items: Anniversary[], today: Date): AnniversaryOccurrence[] {
  return items
    .map((i) => nextAnniversary(i, today))
    .filter((x): x is AnniversaryOccurrence => x !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

// ---------------------------------------------------------------------------
// 日付表示
// ---------------------------------------------------------------------------

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export function formatMd(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})`;
}

export function formatTime(t: number | Date): string {
  const d = typeof t === 'number' ? new Date(t) : t;
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function relativeTime(t: number, now = Date.now()): string {
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  const date = new Date(t);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
