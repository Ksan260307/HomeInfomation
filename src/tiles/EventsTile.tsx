import type { CalendarEvent, CalendarResponse } from '../../shared/types';
import { Skeleton, TileHeader, TileMessage, atLeast, useTileSize } from '../components/tileKit';
import { useNow } from '../hooks/useNow';
import { useRemote } from '../hooks/useRemote';
import { toYmd } from '../lib/holidays';
import { WEEKDAYS, formatTime } from '../lib/utils';
import { useApp } from '../state/store';
import type { TileComponentProps } from './types';
import './events.css';

const PALETTE = ['#7c8cff', '#3fd0ff', '#3ddc97', '#ffb547', '#ff6fb5', '#b38cff'];

function colorFor(e: CalendarEvent, calendars: string[]) {
  if (e.color && /^#?[0-9a-f]{6}$/i.test(e.color)) return e.color.startsWith('#') ? e.color : `#${e.color}`;
  return PALETTE[Math.max(0, calendars.indexOf(e.calendar)) % PALETTE.length];
}

/** 予定を日付ごとにまとめる（複数日にまたがる予定は各日に表示） */
export function groupByDay(events: CalendarEvent[], from: Date, days: number): { date: Date; events: CalendarEvent[] }[] {
  const out: { date: Date; events: CalendarEvent[] }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const start = d.getTime();
    const end = start + 86400_000;
    const list = events.filter((e) => e.start < end && e.end >= start);
    if (list.length) out.push({ date: d, events: list });
  }
  return out;
}

function dayLabel(d: Date, today: Date): string {
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400_000);
  if (diff === 0) return '今日';
  if (diff === 1) return '明日';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function EventsTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const cal = useApp((s) => s.settings.calendar);
  const days = Math.min(92, Math.max(1, Number(props.days) || cal.days || 31));
  const { data, error } = useRemote<CalendarResponse>(`/calendar/events?days=${days}`, 15 * 60_000);
  const now = new Date(useNow(60_000));
  const configured = !!(cal.timetreeEmail && cal.timetreePasswordSet) || cal.icsUrls.length > 0;

  if (!configured) {
    return (
      <div className="events">
        <TileHeader icon="📅" title="予定" />
        <TileMessage icon="🌳">設定 → 予定 で TimeTree のアカウント（または iCal の URL）を登録すると、今日から1か月分の予定を表示します</TileMessage>
      </div>
    );
  }
  if (!data) return error ? <TileMessage icon="⚠️">予定を取得できません</TileMessage> : <Skeleton lines={5} />;

  const calendars = [...new Set(data.events.map((e) => e.calendar))];
  const groups = groupByDay(data.events, now, days);
  const todayKey = toYmd(now);

  if (size.size === 'xs' || (size.size === 's' && size.height < 160)) {
    const next = data.events.find((e) => e.end >= now.getTime());
    return (
      <div className="events events--mini">
        <div className="events-mini-label">📅 次の予定</div>
        {next ? (
          <>
            <div className="events-mini-title">{next.title}</div>
            <div className="events-mini-time">
              {dayLabel(new Date(next.start), now)} {next.allDay ? '終日' : formatTime(next.start)}
            </div>
          </>
        ) : (
          <div className="events-mini-time">予定なし</div>
        )}
      </div>
    );
  }

  return (
    <div className="events">
      <TileHeader icon="📅" title="予定" sub={`${days}日間`} right={data.errors.length ? <span title={data.errors.join('\n')}>⚠️</span> : undefined} />
      {groups.length === 0 ? (
        <TileMessage icon="🌿">これから{days}日間の予定はありません</TileMessage>
      ) : (
        <div className="events-list">
          {groups.map((g) => {
            const key = toYmd(g.date);
            const dow = g.date.getDay();
            return (
              <section key={key} className={`events-day ${key === todayKey ? 'is-today' : ''}`}>
                <div className={`events-date ${dow === 0 ? 'is-sun' : dow === 6 ? 'is-sat' : ''}`}>
                  <span className="events-date-main">{dayLabel(g.date, now)}</span>
                  <span className="events-date-dow">{WEEKDAYS[dow]}</span>
                </div>
                <ul>
                  {g.events.map((e) => (
                    <li key={`${key}-${e.id}`} className={e.end < now.getTime() ? 'is-past' : ''}>
                      <span className="events-dot" style={{ background: colorFor(e, calendars) }} />
                      <span className="events-time">{e.allDay ? '終日' : formatTime(Math.max(e.start, g.date.getTime()))}</span>
                      <span className="events-title">{e.title}</span>
                      {atLeast(size.size, 'l') && e.location && <span className="events-loc">📍{e.location}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
