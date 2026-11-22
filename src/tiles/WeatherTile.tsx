import { Skeleton, TileHeader, TileMessage, atLeast, useTileSize } from '../components/tileKit';
import { useRemote } from '../hooks/useRemote';
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
  const showHourly = size.height > 230 || (size.wide && size.width > 380);
  const showDaily = atLeast(size.size, 'l') || (size.tall && size.height > 420);
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
