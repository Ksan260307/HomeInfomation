import * as rruleNs from 'rrule';
import type { CalendarEvent } from '../../shared/types';

// rrule は Node 実行時は CommonJS、Vite/Vitest では ESM として読み込まれるため両方に対応する
const rruleMod = ((rruleNs as unknown as { default?: typeof rruleNs }).default ?? rruleNs) as typeof rruleNs;
const { rrulestr } = rruleMod;

export const DEFAULT_TZ = 'Asia/Tokyo';
const DAY = 86400_000;

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseLine(line: string): Prop | null {
  const idx = line.indexOf(':');
  if (idx < 0) return null;
  const [head, ...paramParts] = line.slice(0, idx).split(';');
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const [k, v = ''] = p.split('=');
    params[k.toUpperCase()] = v.replace(/^"|"$/g, '');
  }
  return { name: head.toUpperCase(), params, value: line.slice(idx + 1) };
}

function unescapeText(s: string): string {
  return s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

// ---------------------------------------------------------------------------
// タイムゾーン
// 繰り返し予定は「現地の壁時計時刻」で展開しないと、BYDAY などの曜日がずれる
// （例: 日本時間 月曜 8:00 は UTC では日曜 23:00）。
// 壁時計時刻は「UTC として表した数値（wall）」で扱う。
// ---------------------------------------------------------------------------

function partsIn(t: number, tz: string): number[] | null {
  try {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      })
        .formatToParts(new Date(t))
        .map((x) => [x.type, x.value]),
    );
    return [+p.year, +p.month, +p.day, +p.hour, +p.minute, +p.second];
  } catch {
    return null;
  }
}

/** 実時刻 → その地域の壁時計時刻（wall） */
export function wallOf(t: number, tz: string): number {
  const p = partsIn(t, tz);
  if (!p) return t + 9 * 3600_000;
  return Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5]);
}

/** 指定タイムゾーンの壁時計時刻を UTC ミリ秒に変換する */
export function zonedTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const p = partsIn(guess, tz);
  if (!p) return guess - 9 * 3600_000; // 不明なタイムゾーンは日本時間とみなす
  const asUtc = Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5]);
  return guess - (asUtc - guess);
}

/** 壁時計時刻（wall）→ 実時刻 */
export function fromWall(wall: number, tz: string): number {
  const d = new Date(wall);
  return zonedTimeToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), tz);
}

const fmtWall = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * RRULE を壁時計時刻で展開し、期間内の発生時刻（wall）を返す。
 * UNTIL が UTC 指定でも数時間の誤差しか生じないため、そのまま扱う。
 */
export function expandRRule(rule: string, startWall: number, fromWall: number, toWall: number): number[] {
  const body = rule.replace(/^RRULE:/i, '');
  // fmtWall は末尾に Z が付いた UTC 形式（壁時計時刻を UTC として扱う）
  const r = rrulestr(`DTSTART:${fmtWall(startWall)}\nRRULE:${body}`);
  return r.between(new Date(fromWall), new Date(toWall), true).map((d) => d.getTime());
}

// ---------------------------------------------------------------------------

export interface ParsedDate {
  /** 実時刻（UTC ミリ秒） */
  time: number;
  /** 壁時計時刻 */
  wall: number;
  allDay: boolean;
  tz: string;
}

export function parseIcsDate(value: string, params: Record<string, string>, defaultTz = DEFAULT_TZ): ParsedDate | null {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h || params.VALUE === 'DATE') {
    // 終日予定は「その日の 0:00（日本時間）」として扱う
    return { time: zonedTimeToUtc(+y, +mo, +d, 0, 0, 0, defaultTz), wall: Date.UTC(+y, +mo - 1, +d), allDay: true, tz: defaultTz };
  }
  if (z) {
    const time = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
    return { time, wall: wallOf(time, defaultTz), allDay: false, tz: defaultTz };
  }
  const tz = params.TZID || defaultTz;
  return { time: zonedTimeToUtc(+y, +mo, +d, +h, +mi, +s, tz), wall: Date.UTC(+y, +mo - 1, +d, +h, +mi, +s), allDay: false, tz };
}

/**
 * iCal(ICS) を解析し、指定期間に掛かる予定（繰り返しは展開済み）を返す。
 */
export function parseIcs(text: string, calendarName: string, from: number, to: number): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const overrides = new Map<string, Set<number>>();
  let cur: Prop[] | null = null;
  const vevents: Prop[][] = [];

  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') cur = [];
    else if (line === 'END:VEVENT') {
      if (cur) vevents.push(cur);
      cur = null;
    } else if (cur) {
      const p = parseLine(line);
      if (p) cur.push(p);
    }
  }

  // RECURRENCE-ID を持つ（個別に変更された）回は元の繰り返しから除外する
  for (const props of vevents) {
    const uid = props.find((p) => p.name === 'UID')?.value;
    const rid = props.find((p) => p.name === 'RECURRENCE-ID');
    if (uid && rid) {
      const d = parseIcsDate(rid.value, rid.params);
      if (d) {
        if (!overrides.has(uid)) overrides.set(uid, new Set());
        overrides.get(uid)!.add(d.wall);
      }
    }
  }

  for (const props of vevents) {
    const get = (n: string) => props.find((p) => p.name === n);
    const dtstart = get('DTSTART');
    if (!dtstart) continue;
    const start = parseIcsDate(dtstart.value, dtstart.params);
    if (!start) continue;
    const dtend = get('DTEND');
    const endParsed = dtend ? parseIcsDate(dtend.value, dtend.params) : null;
    let duration = endParsed ? endParsed.time - start.time : start.allDay ? DAY : 0;
    if (duration < 0) duration = 0;
    const uid = get('UID')?.value ?? `${calendarName}-${start.time}`;
    const title = unescapeText(get('SUMMARY')?.value ?? '(無題)');
    const location = get('LOCATION')?.value ? unescapeText(get('LOCATION')!.value) : undefined;
    if (get('STATUS')?.value === 'CANCELLED') continue;

    const push = (t: number) => {
      // 終日予定の DTEND は翌日 0:00（排他的）なので 1ms 引いて当日内に収める
      const end = t + duration - (start.allDay && duration > 0 ? 1 : 0);
      if (end < from || t > to) return;
      events.push({ id: `${uid}@${t}`, title, start: t, end: Math.max(end, t), allDay: start.allDay, location, calendar: calendarName });
    };

    const rrule = get('RRULE');
    if (!rrule) {
      push(start.time);
      continue;
    }
    try {
      const skip = new Set<number>(overrides.get(uid) ?? []);
      for (const p of props.filter((x) => x.name === 'EXDATE')) {
        for (const v of p.value.split(',')) {
          const ex = parseIcsDate(v, p.params, start.tz);
          if (ex) skip.add(ex.wall);
        }
      }
      const tz = start.allDay ? DEFAULT_TZ : start.tz;
      for (const w of expandRRule(rrule.value, start.wall, wallOf(from, tz) - duration - DAY, wallOf(to, tz) + DAY)) {
        if (!skip.has(w)) push(fromWall(w, tz));
      }
    } catch {
      push(start.time);
    }
  }
  return events;
}
