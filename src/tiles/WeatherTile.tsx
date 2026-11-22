import { Skeleton, TileHeader, TileMessage, atLeast, useTileSize } from '../components/tileKit';
import { useRemote } from '../hooks/useRemote';
import { holidayName } from '../lib/holidays';
import { WEEKDAYS } from '../lib/utils';
import { weatherInfo } from '../lib/weatherCodes';
import { useApp } from '../state/store';
import type { TileComponentProps } from './types';
import './weather.css';

interface OpenMeteo {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; weather_code: number[]; is_day: number[] };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
  };
}

const r = (n: number | undefined) => (n == null || Number.isNaN(n) ? '–' : Math.round(n));

/** 週間予報（7日分）。横長なら列、縦長なら行で並べ、タイルの大きさに合わせて日数を調整する */
function WeeklyView({ data, name }: { data: OpenMeteo; name: string }) {
  const size = useTileSize();
  const columns = size.width >= size.height * 1.15;
  const showHeader = size.height > 150;
  const room = columns ? Math.floor(size.width / 62) : Math.floor((size.height - (showHeader ? 46 : 16)) / 34);
  const count = Math.max(2, Math.min(7, room));
  const days = data.daily.time.slice(0, count);
  const compact = columns ? size.height < 170 : size.width < 260;

  return (
    <div className={`wx wx-week ${columns ? 'is-columns' : 'is-rows'} ${compact ? 'is-compact' : ''}`}>
      {showHeader && <TileHeader icon="📍" title={name} sub="週間予報" />}
      <div className="wx-week-list">
        {days.map((d, i) => {
          const date = new Date(`${d}T00:00:00`);
          const dow = date.getDay();
          const w = weatherInfo(data.daily.weather_code[i]);
          const hol = holidayName(date);
          const label = i === 0 ? '今日' : i === 1 ? '明日' : `${date.getMonth() + 1}/${date.getDate()}`;
          return (
            <div key={d} className={`wx-wd ${i === 0 ? 'is-today' : ''}`} title={w.label}>
              <span className={`wx-wd-name ${hol || dow === 0 ? 'is-sun' : dow === 6 ? 'is-sat' : ''}`}>
                {label}
                <small>（{WEEKDAYS[dow]}）</small>
              </span>
              <span className="wx-wd-icon">{w.icon}</span>
              {!compact && !columns && <span className="wx-wd-label">{w.label}</span>}
              <span className="wx-wd-temp">
                <b className="t-hi">{r(data.daily.temperature_2m_max[i])}°</b>
                <b className="t-lo">{r(data.daily.temperature_2m_min[i])}°</b>
              </span>
              {!compact && <span className="wx-wd-pop">☔{r(data.daily.precipitation_probability_max[i])}%</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WeatherTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const loc = useApp((s) => s.settings.location);
  const lat = Number(props.lat) || null;
  const lon = Number(props.lon) || null;
  const name = (typeof props.name === 'string' && props.name) || loc.name;
  const path = lat && lon ? `/weather?lat=${lat}&lon=${lon}` : '/weather';
  const { data, error } = useRemote<OpenMeteo>(path, 10 * 60_000);

  if (!data) return error ? <TileMessage icon="🌐">天気を取得できません</TileMessage> : <Skeleton />;

  const c = data.current;
  const now = weatherInfo(c.weather_code, c.is_day === 1);
  const today = { max: data.daily.temperature_2m_max[0], min: data.daily.temperature_2m_min[0], pop: data.daily.precipitation_probability_max[0] };

  const view = String(props.view ?? 'auto');
  if (view === 'weekly') return <WeeklyView data={data} name={name} />;

  if (size.size === 'xs') {
    return (
      <div className="wx wx--xs">
        <span className="wx-icon">{now.icon}</span>
        <span className="wx-temp">{r(c.temperature_2m)}°</span>
      </div>
    );
  }

  // 現在時刻以降の1時間ごとの予報
  const hourStart = Math.max(0, data.hourly.time.findIndex((t) => t >= c.time.slice(0, 13)));
  const showHourly = view !== 'now' && (view === 'hourly' || size.height > 230 || (size.wide && size.width > 380));
  const showDaily = view === 'auto' && (atLeast(size.size, 'l') || (size.tall && size.height > 420));
  const hourlyCount = Math.max(3, Math.min(12, Math.floor((size.width - 32) / (size.wide && !showDaily ? 64 : 58))));
  const dailyCount = Math.max(3, Math.min(7, Math.floor((size.height - 300) / 38)));
  const hours = Array.from({ length: hourlyCount }, (_, i) => hourStart + 1 + i).filter((i) => i < data.hourly.time.length);

  return (
    <div className={`wx wx--${size.size} ${size.wide ? 'is-wide' : ''}`}>
      <TileHeader icon="📍" title={name} sub={atLeast(size.size, 'm') ? now.label : undefined} />
      <div className="wx-main">
        <div className="wx-now">
          <span className="wx-icon">{now.icon}</span>
          <span className="wx-temp">
            {r(c.temperature_2m)}
            <small>°C</small>
          </span>
        </div>
        <div className="wx-meta">
          <span>
            <b className="t-hi">{r(today.max)}°</b> / <b className="t-lo">{r(today.min)}°</b>
          </span>
          <span>☔ {r(today.pop)}%</span>
          {atLeast(size.size, 'm') && (
            <>
              <span>体感 {r(c.apparent_temperature)}°</span>
              <span>💧 {r(c.relative_humidity_2m)}%</span>
              {size.width > 330 && <span>💨 {r(c.wind_speed_10m)}m/s</span>}
            </>
          )}
        </div>
      </div>

      {showHourly && hours.length > 0 && (
        <div className="wx-hourly">
          {hours.map((i) => {
            const w = weatherInfo(data.hourly.weather_code[i], data.hourly.is_day[i] === 1);
            return (
              <div key={i} className="wx-hour">
                <span className="wx-hour-time">{Number(data.hourly.time[i].slice(11, 13))}時</span>
                <span className="wx-hour-icon">{w.icon}</span>
                <span className="wx-hour-temp">{r(data.hourly.temperature_2m[i])}°</span>
                <span className="wx-hour-pop">{r(data.hourly.precipitation_probability[i])}%</span>
              </div>
            );
          })}
        </div>
      )}

      {showDaily && (
        <div className="wx-daily">
          {data.daily.time.slice(1, 1 + dailyCount).map((d, idx) => {
            const i = idx + 1;
            const date = new Date(`${d}T00:00:00`);
            const w = weatherInfo(data.daily.weather_code[i]);
            const day = date.getDay();
            return (
              <div key={d} className="wx-day">
                <span className={`wx-day-name ${day === 0 ? 'is-sun' : day === 6 ? 'is-sat' : ''}`}>
                  {date.getMonth() + 1}/{date.getDate()}（{WEEKDAYS[day]}）
                </span>
                <span className="wx-day-icon">{w.icon}</span>
                <span className="wx-day-pop">☔{r(data.daily.precipitation_probability_max[i])}%</span>
                <span className="wx-day-temp">
                  <b className="t-hi">{r(data.daily.temperature_2m_max[i])}°</b>
                  <b className="t-lo">{r(data.daily.temperature_2m_min[i])}°</b>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
