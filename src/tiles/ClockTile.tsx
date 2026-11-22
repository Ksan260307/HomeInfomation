import { atLeast, useTileSize } from '../components/tileKit';
import { useNow } from '../hooks/useNow';
import { holidayName } from '../lib/holidays';
import { WEEKDAYS } from '../lib/utils';
import type { TileComponentProps } from './types';
import './clock.css';

function AnalogClock({ date, seconds }: { date: Date; seconds: boolean }) {
  const s = date.getSeconds();
  const m = date.getMinutes() + s / 60;
  const h = (date.getHours() % 12) + m / 60;
  return (
    <svg className="analog" viewBox="0 0 200 200" role="img" aria-label="アナログ時計">
      <circle cx="100" cy="100" r="96" className="analog-face" />
      {Array.from({ length: 60 }, (_, i) => (
        <line
          key={i}
          x1="100"
          y1={i % 5 === 0 ? 12 : 10}
          x2="100"
          y2={i % 5 === 0 ? 26 : 16}
          className={i % 5 === 0 ? 'analog-tick major' : 'analog-tick'}
          transform={`rotate(${i * 6} 100 100)`}
        />
      ))}
      <line x1="100" y1="100" x2="100" y2="52" className="analog-hour" transform={`rotate(${h * 30} 100 100)`} />
      <line x1="100" y1="100" x2="100" y2="30" className="analog-minute" transform={`rotate(${m * 6} 100 100)`} />
      {seconds && <line x1="100" y1="114" x2="100" y2="24" className="analog-second" transform={`rotate(${s * 6} 100 100)`} />}
      <circle cx="100" cy="100" r="5" className="analog-pin" />
    </svg>
  );
}

export function ClockTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const showSeconds = props.seconds === true;
  const now = useNow(showSeconds || props.style === 'analog' ? 1000 : 1000);
  const date = new Date(now);
  const style = String(props.style ?? 'auto');
  const analog = style === 'analog' || (style === 'auto' && atLeast(size.size, 'l') && !size.wide);
  const showDate = props.date !== false && (size.height > 130 || size.wide);

  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const holiday = holidayName(date);
  const reiwa = date.getFullYear() - 2018;
  const dateText = `${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAYS[date.getDay()]}）`;
  const dayClass = holiday || date.getDay() === 0 ? 'is-sun' : date.getDay() === 6 ? 'is-sat' : '';

  return (
    <div className={`clock ${analog ? 'is-analog' : 'is-digital'} ${showSeconds ? 'has-seconds' : ''}`}>
      {analog && <AnalogClock date={date} seconds={props.seconds !== false} />}
      <div className="clock-time" aria-label={`${hh}時${mm}分`}>
        <span>{hh}</span>
        <span className="clock-colon">:</span>
        <span>{mm}</span>
        {showSeconds && !analog && <span className="clock-sec">{ss}</span>}
      </div>
      {showDate && (
        <div className={`clock-date ${dayClass}`}>
          {atLeast(size.size, 'm') && size.width > 260 && <span className="clock-era">令和{reiwa}年</span>}
          <span>{dateText}</span>
          {holiday && <span className="chip chip--sun">{holiday}</span>}
        </div>
      )}
    </div>
  );
}
