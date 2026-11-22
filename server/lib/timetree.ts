import { randomUUID } from 'node:crypto';
import type { CalendarEvent } from '../../shared/types';
import { fetchRaw } from './http';
import { DEFAULT_TZ, expandRRule, fromWall, parseIcsDate, wallOf, zonedTimeToUtc } from './ics';

/**
 * TimeTree の Web 版が利用している非公式 API のクライアント（無料・API キー不要）。
 * 公式の公開 API は 2023 年末に終了しているため、Web 版と同じくメールアドレスとパスワードでログインする。
 * 仕様は予告なく変わる可能性がある。参考: https://github.com/eoleedi/TimeTree-Exporter
 */
const API = 'https://timetreeapp.com/api/v1';
const HEADERS = { 'Content-Type': 'application/json', 'X-Timetreea': 'web/2.1.0/en' };

export interface TimeTreeCalendarInfo {
  id: string;
  name: string;
  color?: string;
}

interface RawEvent {
  uuid?: string;
  id?: string | number;
  title?: string;
  start_at?: number;
  end_at?: number;
  all_day?: boolean;
  start_timezone?: string;
  end_timezone?: string;
  location?: string;
  recurrences?: string[] | null;
  category?: number;
  deactivated_at?: number | null;
  deleted_at?: number | null;
}

export class TimeTreeError extends Error {}

export class TimeTreeClient {
  private sessionId: string | null = null;

  constructor(
    private readonly email: string,
    private readonly password: string,
  ) {}

  private async login(): Promise<void> {
    const res = await fetchRaw(`${API}/auth/email/signin`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({ uid: this.email, password: this.password, uuid: randomUUID().replace(/-/g, '') }),
    });
    if (!res.ok) {
      let code: number | undefined;
      try {
        code = ((await res.json()) as { error?: { code?: number } }).error?.code;
      } catch {
        /* noop */
      }
      if (code === -702) throw new TimeTreeError('TimeTree: メールアドレスまたはパスワードが違います');
      if (code === -495) throw new TimeTreeError('TimeTree: ログイン試行が多すぎます。しばらく待ってください');
      throw new TimeTreeError(`TimeTree: ログインに失敗しました (${res.status})`);
    }
    const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie') ?? ''];
    const match = cookies.join(';').match(/_session_id=([^;]+)/);
    if (!match) throw new TimeTreeError('TimeTree: セッションを取得できませんでした');
    this.sessionId = match[1];
  }

  private async get<T>(path: string, retry = true): Promise<T> {
    if (!this.sessionId) await this.login();
    const res = await fetchRaw(`${API}${path}`, { headers: { ...HEADERS, Cookie: `_session_id=${this.sessionId}` } });
    if ((res.status === 401 || res.status === 403) && retry) {
      this.sessionId = null;
      return this.get<T>(path, false);
    }
    if (!res.ok) throw new TimeTreeError(`TimeTree: 取得に失敗しました (${res.status})`);
    return (await res.json()) as T;
  }

  async calendars(): Promise<TimeTreeCalendarInfo[]> {
    const json = await this.get<{ calendars: Array<Record<string, unknown>> }>('/calendars?since=0');
    return (json.calendars ?? [])
      .filter((c) => !c.deactivated_at)
      .map((c) => ({
        id: String(c.id),
        name: String(c.name ?? 'カレンダー'),
        color: typeof c.color === 'string' ? c.color : undefined,
      }));
  }

  async rawEvents(calendarId: string): Promise<RawEvent[]> {
    const out: RawEvent[] = [];
    let path = `/calendar/${encodeURIComponent(calendarId)}/events/sync`;
    for (let i = 0; i < 50; i++) {
      const json = await this.get<{ events: RawEvent[]; chunk?: boolean; since?: number }>(path);
      out.push(...(json.events ?? []));
      if (!json.chunk || json.since == null) break;
      path = `/calendar/${encodeURIComponent(calendarId)}/events/sync?since=${json.since}`;
    }
    return out;
  }
}

const DAY = 86400_000;

/** wall（壁時計時刻を UTC で表した数値）の日付キー */
const dayKey = (wall: number) => new Date(wall).toISOString().slice(0, 10);

/** TimeTree の予定を、指定期間内の CalendarEvent に展開する（繰り返し予定にも対応） */
export function expandTimeTreeEvents(raw: RawEvent[], calendarName: string, from: number, to: number, color?: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const ev of raw) {
    if (ev.deactivated_at || ev.deleted_at) continue;
    if (ev.category === 2) continue; // メモ（キープ）は除外
    if (typeof ev.start_at !== 'number') continue;
    const allDay = !!ev.all_day;
    const tz = ev.start_timezone || DEFAULT_TZ;
    const endAt = typeof ev.end_at === 'number' ? ev.end_at : ev.start_at;
    const duration = Math.max(0, endAt - ev.start_at);
    const startWall = wallOf(ev.start_at, tz);
    const uid = String(ev.uuid ?? ev.id ?? `${calendarName}-${ev.start_at}`);

    /** 発生日時（wall）→ 表示用の予定 */
    const toEvent = (wall: number): CalendarEvent | null => {
      let start: number;
      let end: number;
      if (allDay) {
        // 終日予定は日付だけを使い、日本時間のその日 0:00〜最終日 23:59 とする
        const s = new Date(wall);
        const e = new Date(wall + duration);
        start = zonedTimeToUtc(s.getUTCFullYear(), s.getUTCMonth() + 1, s.getUTCDate(), 0, 0, 0, DEFAULT_TZ);
        end = zonedTimeToUtc(e.getUTCFullYear(), e.getUTCMonth() + 1, e.getUTCDate(), 23, 59, 59, DEFAULT_TZ);
      } else {
        start = fromWall(wall, tz);
        end = start + duration;
      }
      if (end < from || start > to) return null;
      return { id: `${uid}@${start}`, title: ev.title || '(無題)', start, end, allDay, location: ev.location || undefined, calendar: calendarName, color };
    };

    const rules = (ev.recurrences ?? []).filter(Boolean);
    const rrule = rules.find((r) => r.toUpperCase().startsWith('RRULE'));
    if (!rrule) {
      const e = toEvent(startWall);
      if (e) out.push(e);
      continue;
    }
    try {
      const exdates = new Set<string>();
      for (const r of rules.filter((x) => x.toUpperCase().startsWith('EXDATE'))) {
        const idx = r.indexOf(':');
        const head = r.slice(0, idx);
        const tzid = head.match(/TZID=([^;:]+)/)?.[1];
        for (const v of r.slice(idx + 1).split(',')) {
          const parsed = parseIcsDate(v, tzid ? { TZID: tzid } : head.includes('VALUE=DATE') ? { VALUE: 'DATE' } : {}, tz);
          if (parsed) exdates.add(dayKey(allDay ? parsed.wall : wallOf(parsed.time, tz)));
        }
      }
      for (const w of expandRRule(rrule, startWall, wallOf(from, tz) - duration - DAY, wallOf(to, tz) + DAY)) {
        if (exdates.has(dayKey(w))) continue;
        const e = toEvent(w);
        if (e) out.push(e);
      }
    } catch {
      const e = toEvent(startWall);
      if (e) out.push(e);
    }
  }
  return out;
}
