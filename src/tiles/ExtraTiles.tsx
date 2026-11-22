import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CalendarResponse, WarningResponse } from '../../shared/types';
import { Icon } from '../components/icons';
import { Skeleton, TileHeader, TileMessage, atLeast, openExternal, useTileSize } from '../components/tileKit';
import { useNow } from '../hooks/useNow';
import { useRemote } from '../hooks/useRemote';
import { holidayName, toYmd } from '../lib/holidays';
import { sounds, unlockAudio } from '../lib/sound';
import { WEEKDAYS, formatMd, garbageOn, upcomingAnniversaries } from '../lib/utils';
import { useApp } from '../state/store';
import type { TileComponentProps } from './types';
import './extra.css';

// ---------------------------------------------------------------------------
// 月間カレンダー
// ---------------------------------------------------------------------------

export function CalendarTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const now = new Date(useNow(60_000));
  const [shift, setShift] = useState(0);
  const rules = useApp((s) => s.settings.garbage.rules);
  const cal = useApp((s) => s.settings.calendar);
  const configured = !!(cal.timetreeEmail && cal.timetreePasswordSet) || cal.icsUrls.length > 0;
  const { data } = useRemote<CalendarResponse>(configured && props.events !== false ? `/calendar/events?days=${cal.days || 31}` : null, 15 * 60_000);

  const month = new Date(now.getFullYear(), now.getMonth() + shift, 1);
  const startDow = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((startDow + daysInMonth) / 7);
  const todayKey = toYmd(now);
  const showGarbage = props.garbage !== false && atLeast(size.size, 'l');
  const showHolidayName = size.width / 7 > 70 && size.height / (weeks + 2) > 52;

  const eventDays = useMemo(() => {
    const set = new Set<string>();
    for (const e of data?.events ?? []) {
      for (let t = e.start; t <= e.end; t += 86400_000) set.add(toYmd(new Date(t)));
    }
    return set;
  }, [data]);

  const cells = Array.from({ length: weeks * 7 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - startDow + 1));

  return (
    <div className="cal">
      <div className="cal-head">
        <span className="cal-title">
          {month.getFullYear()}年<b>{month.getMonth() + 1}月</b>
        </span>
        {atLeast(size.size, 's') && (
          <span className="cal-nav">
            {shift !== 0 && (
              <button type="button" className="link-btn" onClick={() => setShift(0)}>
                今月
              </button>
            )}
            <button type="button" className="icon-btn" aria-label="前の月" onClick={() => setShift((s) => s - 1)}>
              <Icon name="chevronLeft" size={18} />
            </button>
            <button type="button" className="icon-btn" aria-label="次の月" onClick={() => setShift((s) => s + 1)}>
              <Icon name="chevronRight" size={18} />
            </button>
          </span>
        )}
      </div>
      <div className="cal-grid" style={{ gridTemplateRows: `auto repeat(${weeks}, 1fr)` }}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`cal-dow ${i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : ''}`}>
            {w}
          </div>
        ))}
        {cells.map((d) => {
          const key = toYmd(d);
          const inMonth = d.getMonth() === month.getMonth();
          const hol = holidayName(d);
          const cls = [
            'cal-day',
            !inMonth && 'is-out',
            key === todayKey && 'is-today',
            hol || d.getDay() === 0 ? 'is-sun' : d.getDay() === 6 ? 'is-sat' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const garbage = showGarbage && inMonth ? garbageOn(d, rules) : [];
          return (
            <div key={key} className={cls} title={hol ?? undefined}>
              <span className="cal-num">{d.getDate()}</span>
              {showHolidayName && hol && inMonth && <span className="cal-hol">{hol}</span>}
              <span className="cal-marks">
                {eventDays.has(key) && inMonth && <span className="cal-dot" />}
                {garbage.map((g) => (
                  <span key={g.id} className="cal-garbage" title={g.name}>
                    {g.icon}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ゴミ出し
// ---------------------------------------------------------------------------

export function GarbageTile() {
  const size = useTileSize();
  const now = new Date(useNow(60_000));
  const rules = useApp((s) => s.settings.garbage.rules);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const t = garbageOn(today, rules);
  const tm = garbageOn(tomorrow, rules);

  if (!rules.length) return <TileMessage icon="🗑️">設定 → ゴミ出し で収集日を登録してください</TileMessage>;

  if (size.size === 'xs') {
    const g = t[0];
    return (
      <div className="gb gb--mini">
        <span className="gb-mini-icon">{g ? g.icon : '🗑️'}</span>
        <span className="gb-mini-label">{g ? g.name : '今日はなし'}</span>
      </div>
    );
  }

  const week = Array.from({ length: 7 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  const showWeek = size.height > 300 || (size.wide && size.width > 520);

  const renderDay = (label: string, list: typeof t) => (
    <div className="gb-day">
      <div className="gb-day-label">{label}</div>
      {list.length ? (
        list.map((g) => (
          <div key={g.id} className="gb-item" style={{ '--gb': g.color } as CSSProperties}>
            <span className="gb-icon">{g.icon}</span>
            <span className="gb-name">{g.name}</span>
          </div>
        ))
      ) : (
        <div className="gb-none">収集なし</div>
      )}
    </div>
  );

  return (
    <div className={`gb ${size.wide ? 'is-wide' : ''}`}>
      <TileHeader icon="🗑️" title="ゴミ出し" />
      <div className="gb-days">
        {renderDay(`今日 ${formatMd(today)}`, t)}
        {renderDay(`明日 ${formatMd(tomorrow)}`, tm)}
      </div>
      {showWeek && (
        <div className="gb-week">
          {week.map((d) => {
            const list = garbageOn(d, rules);
            return (
              <div key={d.getTime()} className="gb-week-day">
                <span className={`gb-week-dow ${d.getDay() === 0 ? 'is-sun' : d.getDay() === 6 ? 'is-sat' : ''}`}>{WEEKDAYS[d.getDay()]}</span>
                <span className="gb-week-icons">{list.length ? list.map((g) => g.icon).join('') : '・'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// キッチンタイマー
// ---------------------------------------------------------------------------

interface TimerState {
  endAt: number | null;
  remaining: number;
  total: number;
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

export function TimerTile({ tile, props }: TileComponentProps) {
  const size = useTileSize();
  const storeKey = `hi:timer:${tile.id}`;
  const [st, setSt] = useState<TimerState>(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey) ?? '') as TimerState;
    } catch {
      return { endAt: null, remaining: 0, total: 0 };
    }
  });
  const [ringing, setRinging] = useState(false);
  const now = useNow(st.endAt ? 250 : 60_000);
  const presets = String(props.presets ?? '1,3,5,10,15,30')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => x > 0)
    .slice(0, 8);

  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(st));
    } catch {
      /* noop */
    }
  }, [st, storeKey]);

  const left = st.endAt ? st.endAt - now : st.remaining;
  const running = st.endAt !== null;

  // 時間になったらアラーム
  useEffect(() => {
    if (running && left <= 0) {
      setSt({ endAt: null, remaining: 0, total: st.total });
      setRinging(true);
    }
  }, [running, left, st.total]);

  useEffect(() => {
    if (!ringing) return;
    sounds.alarm();
    const iv = window.setInterval(sounds.alarm, 2600);
    const stop = window.setTimeout(() => setRinging(false), 60_000);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(stop);
    };
  }, [ringing]);

  const start = (ms: number) => {
    unlockAudio();
    setRinging(false);
    setSt({ endAt: Date.now() + ms, remaining: ms, total: ms });
  };
  const pause = () => setSt({ endAt: null, remaining: Math.max(0, left), total: st.total });
  const resume = () => setSt({ ...st, endAt: Date.now() + st.remaining });
  const reset = () => {
    setRinging(false);
    setSt({ endAt: null, remaining: 0, total: 0 });
  };
  const add = (ms: number) => (running ? setSt({ ...st, endAt: (st.endAt ?? Date.now()) + ms, total: st.total + ms }) : start(st.remaining + ms));

  const progress = st.total ? Math.max(0, Math.min(1, left / st.total)) : 0;
  const active = running || st.remaining > 0;

  if (ringing) {
    return (
      <button type="button" className="timer timer--ringing" onClick={reset}>
        <span className="timer-bell">⏰</span>
        <span className="timer-done">時間です！</span>
        <span className="timer-sub">タップで止める</span>
      </button>
    );
  }

  if (!active) {
    return (
      <div className="timer">
        {size.size !== 'xs' && <TileHeader icon="⏱️" title="タイマー" />}
        <div className="timer-presets">
          {(size.size === 'xs' ? presets.slice(0, 4) : presets).map((m) => (
            <button key={m} type="button" className="timer-preset" onClick={() => start(m * 60_000)}>
              {m}
              <small>分</small>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const R = 44;
  const C = 2 * Math.PI * R;
  return (
    <div className="timer is-active">
      <div className="timer-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={R} className="timer-track" />
          <circle cx="50" cy="50" r={R} className="timer-progress" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
        </svg>
        <span className="timer-left">{fmt(left)}</span>
      </div>
      {size.size !== 'xs' && (
        <div className="timer-controls">
          <button type="button" className="icon-btn glass" aria-label={running ? '一時停止' : '再開'} onClick={running ? pause : resume}>
            <Icon name={running ? 'pause' : 'play'} size={18} />
          </button>
          {atLeast(size.size, 'm') && (
            <button type="button" className="chip-btn" onClick={() => add(60_000)}>
              +1分
            </button>
          )}
          <button type="button" className="icon-btn glass" aria-label="リセット" onClick={reset}>
            <Icon name="x" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 気象警報・注意報
// ---------------------------------------------------------------------------

const LEVEL_CLASS: Record<number, string> = { 20: 'lv2', 30: 'lv3', 40: 'lv4', 50: 'lv5' };

export function WarningTile() {
  const size = useTileSize();
  const loc = useApp((s) => s.settings.location);
  const { data, error } = useRemote<WarningResponse>('/jma/warnings', 5 * 60_000);
  const url = `https://www.jma.go.jp/bosai/warning/#area_type=class20s&area_code=${loc.jmaArea}&lang=ja`;

  if (!data) return error ? <TileMessage icon="⚠️">警報を取得できません</TileMessage> : <Skeleton lines={2} />;
  const top = data.items[0];
  const level = top ? (LEVEL_CLASS[top.level] ?? 'lv2') : 'none';

  if (size.size === 'xs') {
    return (
      <button type="button" className={`warn warn--mini is-${level}`} onClick={() => openExternal(url)}>
        <span className="warn-mini-icon">{top ? '⚠️' : '✅'}</span>
        <span className="warn-mini-text">{top ? top.name.replace(/^レベル\d/, '') : '警報なし'}</span>
      </button>
    );
  }

  return (
    <div className={`warn is-${level}`}>
      <TileHeader icon="⚠️" title="警報・注意報" sub={data.areaName} />
      {data.items.length === 0 ? (
        <div className="warn-clear">
          <span>✅</span>
          <span>発表されていません</span>
        </div>
      ) : (
        <div className="warn-items">
          {data.items.map((w) => (
            <span key={w.code} className={`warn-chip ${LEVEL_CLASS[w.level] ?? 'lv2'}`}>
              {w.name}
            </span>
          ))}
        </div>
      )}
      {atLeast(size.size, 'm') && data.headline && size.height > 220 && <p className="warn-headline">{data.headline}</p>}
      {size.height > 160 && (
        <button type="button" className="link-btn warn-foot" onClick={() => openExternal(url)}>
          {data.reportDatetime ? `${new Date(data.reportDatetime).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 発表` : ''}
           ・ 気象庁で見る
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 記念日カウントダウン
// ---------------------------------------------------------------------------

export function AnniversaryTile() {
  const size = useTileSize();
  const items = useApp((s) => s.settings.anniversaries.items);
  const now = new Date(useNow(60_000));
  const list = upcomingAnniversaries(items, now);
  if (!list.length) return <TileMessage icon="🎂">設定 → 記念日 で誕生日や記念日を登録してください</TileMessage>;
  const first = list[0];
  const label = (o: (typeof list)[number]) =>
    o.years != null ? (o.item.kind === 'birthday' ? `${o.years}歳の誕生日` : `${o.years}周年`) : o.item.kind === 'birthday' ? '誕生日' : '';
  const rest = list.slice(1, 1 + Math.max(0, Math.floor((size.height - 230) / 36)));

  return (
    <div className="anniv">
      {size.size !== 'xs' && <TileHeader icon="🎉" title="記念日" />}
      <div className={`anniv-main ${first.daysLeft === 0 ? 'is-today' : ''}`}>
        <span className="anniv-icon">{first.item.icon || '🎉'}</span>
        <span className="anniv-name">{first.item.name}</span>
        {size.size !== 'xs' && label(first) && <span className="anniv-sub">{label(first)}</span>}
        {first.daysLeft === 0 ? (
          <span className="anniv-today">今日！</span>
        ) : (
          <span className="anniv-count">
            あと<b>{first.daysLeft}</b>日
          </span>
        )}
      </div>
      {rest.length > 0 && (
        <ul className="anniv-list">
          {rest.map((o) => (
            <li key={o.item.id}>
              <span>{o.item.icon}</span>
              <span className="anniv-list-name">
                {o.item.name}
                {label(o) && <small> {label(o)}</small>}
              </span>
              <span className="anniv-list-days">{o.daysLeft === 0 ? '今日' : `${o.daysLeft}日`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// フォトフレーム
// ---------------------------------------------------------------------------

export function PhotoTile({ props }: TileComponentProps) {
  const { data, error } = useRemote<{ dir: string; files: { name: string; url: string }[] }>('/photos', 5 * 60_000);
  const settingsInterval = useApp((s) => s.settings.photos.intervalSec);
  const interval = Math.max(3, Number(props.interval) || settingsInterval || 15) * 1000;
  const now = useNow(1000);
  const fit = props.fit === 'contain' ? 'contain' : 'cover';
  const files = useMemo(() => data?.files ?? [], [data]);
  const order = useMemo(() => {
    const idx = files.map((_, i) => i);
    if (props.shuffle !== false) {
      for (let i = idx.length - 1; i > 0; i--) {
        const j = (i * 7919 + 104729) % (i + 1);
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
    }
    return idx;
  }, [files, props.shuffle]);
  const pos = Math.floor(now / interval);
  const current = files.length ? files[order[pos % files.length]] : null;
  const prevRef = useRef<string | null>(null);
  const [prev, setPrev] = useState<string | null>(null);

  useEffect(() => {
    if (current && prevRef.current !== current.url) {
      setPrev(prevRef.current);
      prevRef.current = current.url;
    }
  }, [current]);

  if (!data) return error ? <TileMessage icon="🖼️">写真を読み込めません</TileMessage> : <Skeleton />;
  if (!current)
    return (
      <TileMessage icon="🖼️">
        PC の写真フォルダに画像を入れてください
        <br />
        <small className="mono">{data.dir}</small>
      </TileMessage>
    );

  return (
    <div className={`photo fit-${fit}`}>
      {prev && prev !== current.url && <img key={`p-${prev}`} className="photo-img is-prev" src={prev} alt="" />}
      <img key={current.url} className="photo-img is-current" src={current.url} alt={current.name} />
      {fit === 'contain' && <img className="photo-bg" src={current.url} alt="" aria-hidden="true" />}
    </div>
  );
}
