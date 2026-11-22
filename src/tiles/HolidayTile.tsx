import { TileHeader, atLeast, useTileSize } from '../components/tileKit';
import { useNow } from '../hooks/useNow';
import { daysBetween, holidayName, toYmd, upcomingHolidays } from '../lib/holidays';
import { WEEKDAYS } from '../lib/utils';
import './holiday.css';

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const isOff = (d: Date) => d.getDay() === 0 || d.getDay() === 6 || holidayName(d) !== null;
const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;

/** 祝日を含む連休（土日・祝日が続く期間）を求める */
function longWeekend(date: Date): { start: Date; end: Date; days: number } {
  const start = new Date(date);
  const end = new Date(date);
  while (isOff(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1))) start.setDate(start.getDate() - 1);
  while (isOff(new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1))) end.setDate(end.getDate() + 1);
  return { start, end, days: Math.round((end.getTime() - start.getTime()) / 86400_000) + 1 };
}

export function HolidayTile() {
  const size = useTileSize();
  const now = new Date(useNow(60_000));
  const todayKey = toYmd(now);
  const todayName = holidayName(now);
  const list = upcomingHolidays(new Date(now.getFullYear(), now.getMonth(), now.getDate() + (todayName ? 1 : 0)), 8);
  const next = list[0];
  const nextDate = parse(next.date);
  const days = daysBetween(todayKey, next.date);
  const lw = longWeekend(nextDate);
  const listCount = Math.max(0, Math.floor((size.height - 250) / 34));

  if (size.size === 'xs') {
    return (
      <div className="hol hol--xs">
        <span className="hol-label">{next.name}</span>
        <span className="hol-days">
          {days}
          <small>日</small>
        </span>
      </div>
    );
  }

  return (
    <div className="hol">
      <TileHeader icon="🎌" title={todayName ? `今日は${todayName}` : '次の祝日'} />
      <div className="hol-main">
        <div className="hol-name">{next.name}</div>
        <div className="hol-date">
          {nextDate.getFullYear() !== now.getFullYear() && `${nextDate.getFullYear()}年 `}
          {md(nextDate)}
        </div>
        <div className="hol-count">
          <span className="hol-pre">あと</span>
          <span className="hol-days">{days}</span>
          <span className="hol-pre">日</span>
        </div>
        {lw.days >= 3 && atLeast(size.size, 's') && size.height > 200 && (
          <div className="chip chip--accent">
            {md(lw.start)}〜{md(lw.end)} {lw.days}連休
          </div>
        )}
      </div>
      {listCount > 0 && (
        <ul className="hol-list">
          {list.slice(1, 1 + listCount).map((h) => {
            const d = parse(h.date);
            return (
              <li key={h.date}>
                <span className="hol-list-date">{md(d)}</span>
                <span className="hol-list-name">{h.name}</span>
                <span className="hol-list-days">{daysBetween(todayKey, h.date)}日後</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
