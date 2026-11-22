/**
 * 日本の祝日（内閣府「国民の祝日」）をローカルで計算する。外部APIに依存しないのでオフラインでも動く。
 * 対応範囲: 2000〜2099年（春分・秋分は近似式。官報で確定する前年2月までは推定値）
 */
export interface Holiday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
export const toYmd = (date: Date) => ymd(date.getFullYear(), date.getMonth() + 1, date.getDate());

function nthMonday(y: number, m: number, n: number): number {
  const first = new Date(y, m - 1, 1).getDay();
  const offset = (8 - first) % 7; // 最初の月曜日までの日数
  return 1 + offset + (n - 1) * 7;
}

function vernalEquinox(y: number): number {
  return Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
}

function autumnalEquinox(y: number): number {
  return Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
}

function baseHolidays(y: number): Map<string, string> {
  const h = new Map<string, string>();
  const add = (m: number, d: number, name: string) => h.set(ymd(y, m, d), name);

  add(1, 1, '元日');
  add(1, nthMonday(y, 1, 2), '成人の日');
  add(2, 11, '建国記念の日');
  if (y >= 2020) add(2, 23, '天皇誕生日');
  else if (y <= 2018) add(12, 23, '天皇誕生日');
  add(3, vernalEquinox(y), '春分の日');
  add(4, 29, '昭和の日');
  add(5, 3, '憲法記念日');
  add(5, 4, 'みどりの日');
  add(5, 5, 'こどもの日');

  // 東京オリンピック・パラリンピックに伴う特例（2020・2021年）
  if (y === 2020) {
    add(7, 23, '海の日');
    add(7, 24, 'スポーツの日');
    add(8, 10, '山の日');
  } else if (y === 2021) {
    add(7, 22, '海の日');
    add(7, 23, 'スポーツの日');
    add(8, 8, '山の日');
  } else {
    add(7, nthMonday(y, 7, 3), '海の日');
    if (y >= 2016) add(8, 11, '山の日');
    add(10, nthMonday(y, 10, 2), y >= 2020 ? 'スポーツの日' : '体育の日');
  }
  add(9, nthMonday(y, 9, 3), '敬老の日');
  add(9, autumnalEquinox(y), '秋分の日');
  add(11, 3, '文化の日');
  add(11, 23, '勤労感謝の日');
  if (y === 2019) {
    add(5, 1, '天皇の即位の日');
    add(10, 22, '即位礼正殿の儀の行われる日');
  }
  return h;
}

const cache = new Map<number, Holiday[]>();

export function holidaysOfYear(y: number): Holiday[] {
  const cached = cache.get(y);
  if (cached) return cached;
  const h = baseHolidays(y);

  // 国民の休日: 前日と翌日が祝日で挟まれた平日
  for (let m = 1; m <= 12; m++) {
    const days = new Date(y, m, 0).getDate();
    for (let d = 2; d < days; d++) {
      const key = ymd(y, m, d);
      if (h.has(key)) continue;
      const prev = new Date(y, m - 1, d - 1);
      const next = new Date(y, m - 1, d + 1);
      if (h.has(toYmd(prev)) && h.has(toYmd(next)) && new Date(y, m - 1, d).getDay() !== 0) h.set(key, '国民の休日');
    }
  }

  // 振替休日: 祝日が日曜日の場合、その後の最も近い祝日でない日
  for (const key of [...h.keys()].sort()) {
    const [yy, mm, dd] = key.split('-').map(Number);
    const date = new Date(yy, mm - 1, dd);
    if (date.getDay() !== 0 || h.get(key) === '振替休日') continue;
    const sub = new Date(date);
    do sub.setDate(sub.getDate() + 1);
    while (h.has(toYmd(sub)));
    if (sub.getFullYear() === y) h.set(toYmd(sub), '振替休日');
  }

  const list = [...h.entries()].map(([date, name]) => ({ date, name })).sort((a, b) => a.date.localeCompare(b.date));
  cache.set(y, list);
  return list;
}

export function holidayName(date: Date): string | null {
  const key = toYmd(date);
  return holidaysOfYear(date.getFullYear()).find((h) => h.date === key)?.name ?? null;
}

/** 今日以降（今日を含む）の祝日を count 件返す */
export function upcomingHolidays(from: Date, count: number): Holiday[] {
  const today = toYmd(from);
  const out: Holiday[] = [];
  for (let y = from.getFullYear(); out.length < count && y <= from.getFullYear() + 2; y++) {
    for (const h of holidaysOfYear(y)) {
      if (h.date >= today) out.push(h);
      if (out.length >= count) break;
    }
  }
  return out;
}

/** 日付文字列同士の日数差（タイムゾーン・夏時間の影響を受けない） */
export function daysBetween(fromYmd: string, toYmdStr: string): number {
  const [a, b, c] = fromYmd.split('-').map(Number);
  const [d, e, f] = toYmdStr.split('-').map(Number);
  return Math.round((Date.UTC(d, e - 1, f) - Date.UTC(a, b - 1, c)) / 86400_000);
}
