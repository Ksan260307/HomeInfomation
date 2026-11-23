import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { newId } from '../../../shared/defaults';
import type { Anniversary, ExportBundle, FeedSource, FlyerStore, GarbageRule, PublicSettings, Shortcut } from '../../../shared/types';
import { api } from '../../api/client';
import { GRID_PRESETS, repairProfile } from '../../grid/layout';
import { useRemote } from '../../hooks/useRemote';
import { getDeviceName, setDeviceName } from '../../lib/device';
import { WEEKDAYS } from '../../lib/utils';
import { activeProfileId, useApp, useActiveProfile, type ProfileChoice } from '../../state/store';
import { THEMES, WALLPAPERS, applyTheme, resolveTheme } from '../../themes/themes';
import { limitsOf } from '../../tiles/registry';
import { Icon } from '../icons';
import { Button, Field, Segmented, Sheet, Toggle } from '../ui';
import './settings.css';

type SectionId = 'display' | 'region' | 'wifi' | 'tigers' | 'news' | 'flyers' | 'calendar' | 'garbage' | 'anniv' | 'shortcuts' | 'photos' | 'data' | 'about';

const SECTIONS: { id: SectionId; icon: string; label: string }[] = [
  { id: 'display', icon: '🎨', label: '表示・レイアウト' },
  { id: 'region', icon: '📍', label: '地域・天気' },
  { id: 'wifi', icon: '📶', label: 'WiFi' },
  { id: 'tigers', icon: '🐯', label: '阪神タイガース' },
  { id: 'news', icon: '📰', label: 'ニュース' },
  { id: 'flyers', icon: '🛒', label: 'チラシ' },
  { id: 'calendar', icon: '📅', label: '予定（TimeTree）' },
  { id: 'garbage', icon: '🗑️', label: 'ゴミ出し' },
  { id: 'anniv', icon: '🎂', label: '記念日' },
  { id: 'shortcuts', icon: '🔗', label: 'ショートカット' },
  { id: 'photos', icon: '🖼️', label: '写真' },
  { id: 'data', icon: '💾', label: 'データ管理' },
  { id: 'about', icon: 'ℹ️', label: '使い方・情報源' },
];

type Draft = PublicSettings;
type Update = (fn: (d: Draft) => void) => void;

function Section({ title, desc, children }: { title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      {desc && <p className="settings-desc">{desc}</p>}
      <div className="form-group">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 表示
// ---------------------------------------------------------------------------

function DisplaySection({ d, update }: { d: Draft; update: Update }) {
  const profileChoice = useApp((s) => s.profileChoice);
  const setProfileChoice = useApp((s) => s.setProfileChoice);
  const updateProfile = useApp((s) => s.updateProfile);
  const profileId = useApp(activeProfileId);
  const { profile } = useActiveProfile();

  const [deviceName, setName] = useState(getDeviceName);
  const setGrid = (cols: number, rows: number) =>
    updateProfile((p) => repairProfile({ ...p, cols: Math.min(12, Math.max(2, cols)), rows: Math.min(12, Math.max(2, rows)) }, limitsOf));

  return (
    <>
      <Section title="テーマ" desc="テーマは src/themes/themes.ts に追加するだけで増やせます。">
        <div className="theme-grid">
          {[{ id: 'auto', name: '自動', description: 'OS のダーク/ライト設定に合わせる', wallpaper: 'aurora' }, ...THEMES].map((t) => {
            const resolved = resolveTheme(t.id, true);
            const wp = WALLPAPERS.find((w) => w.id === (t.id === 'auto' ? 'aurora' : resolved.wallpaper));
            return (
              <button
                key={t.id}
                type="button"
                className={`theme-card ${d.appearance.theme === t.id ? 'is-active' : ''}`}
                onClick={() => update((x) => void (x.appearance.theme = t.id))}
              >
                <span className="theme-preview" style={{ background: t.id === 'auto' ? 'linear-gradient(135deg, #0b0f1c 50%, #eef1f8 50%)' : wp?.css }}>
                  <span style={{ background: resolved.tokens['--tile-bg'], borderColor: resolved.tokens['--tile-border'] }} />
                  <span style={{ background: resolved.tokens['--accent'] }} />
                </span>
                <span className="theme-name">{t.name}</span>
                <span className="theme-desc">{t.description}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="壁紙">
        <div className="wallpaper-row">
          {[{ id: 'theme', name: 'テーマに合わせる', css: 'conic-gradient(from 90deg, #6c4cff, #14b8e6, #3ddc97, #ffb547, #6c4cff)' }, ...WALLPAPERS].map((w) => (
            <button
              key={w.id}
              type="button"
              className={`wallpaper-chip ${d.appearance.wallpaper === w.id ? 'is-active' : ''}`}
              onClick={() => update((x) => void (x.appearance.wallpaper = w.id))}
            >
              <span style={{ background: w.css }} />
              {w.name}
            </button>
          ))}
        </div>
      </Section>

      <Section title="画面">
        <Field label="画面のスリープを防ぐ" help="iPad はホーム画面に追加したアプリで有効（iPadOS 18.4 以降）。確実にするには iPad の「画面表示と明るさ → 自動ロック → なし」も設定してください。">
          <Toggle checked={d.appearance.keepAwake} onChange={(v) => update((x) => void (x.appearance.keepAwake = v))} />
        </Field>
        <Field label="夜間は画面を暗くする" help="暗くなっている間もタップすると1分間元に戻ります">
          <div className="form-row">
            <Toggle checked={d.appearance.nightDim} onChange={(v) => update((x) => void (x.appearance.nightDim = v))} />
            <input type="time" className="input input--time" value={d.appearance.nightStart} onChange={(e) => update((x) => void (x.appearance.nightStart = e.target.value))} />
            〜
            <input type="time" className="input input--time" value={d.appearance.nightEnd} onChange={(e) => update((x) => void (x.appearance.nightEnd = e.target.value))} />
          </div>
        </Field>
      </Section>

      <Section title="この端末の名前" desc="スマホのリモコンで端末を見分けるための名前です。この項目はすぐに反映されます。">
        <input
          className="input"
          value={deviceName}
          maxLength={40}
          placeholder="例: リビングの iPad"
          onChange={(e) => {
            setName(e.target.value);
            setDeviceName(e.target.value);
          }}
        />
      </Section>

      <Section title="この端末のレイアウト" desc="向き・端末ごとに別々のレイアウトを保存します（Android のホーム画面と同じ）。この項目はすぐに反映されます。">
        <Field label="レイアウトの種類">
          <Segmented<ProfileChoice>
            value={profileChoice}
            onChange={setProfileChoice}
            options={[
              { value: 'auto', label: '自動' },
              { value: 'tablet-landscape', label: '横向き' },
              { value: 'tablet-portrait', label: '縦向き' },
              { value: 'phone', label: 'スマホ' },
            ]}
          />
        </Field>
        <Field label={`グリッドのマス数（${GRID_PRESETS[profileId].label}）`} help="マス数を減らすと、はみ出したタイルは自動で詰め直されます">
          <div className="form-row">
            <span className="stepper">
              横
              <button type="button" className="icon-btn" onClick={() => setGrid(profile.cols - 1, profile.rows)}>
                −
              </button>
              <b>{profile.cols}</b>
              <button type="button" className="icon-btn" onClick={() => setGrid(profile.cols + 1, profile.rows)}>
                ＋
              </button>
            </span>
            <span className="stepper">
              縦
              <button type="button" className="icon-btn" onClick={() => setGrid(profile.cols, profile.rows - 1)}>
                −
              </button>
              <b>{profile.rows}</b>
              <button type="button" className="icon-btn" onClick={() => setGrid(profile.cols, profile.rows + 1)}>
                ＋
              </button>
            </span>
          </div>
        </Field>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// 地域
// ---------------------------------------------------------------------------

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
}

function RegionSection({ d, update }: { d: Draft; update: Update }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const { data: areas } = useRemote<{ offices: { code: string; name: string }[]; cities: Record<string, { code: string; name: string }[]> }>('/jma/areas', 24 * 3600_000);
  const cities = areas?.cities[d.location.jmaOffice] ?? [];

  const search = async () => {
    if (!q.trim()) return;
    try {
      const r = await api.get<{ results?: GeoResult[] }>(`/geocode?q=${encodeURIComponent(q.trim())}`);
      setResults(r.results ?? []);
    } catch {
      setResults([]);
    }
  };

  return (
    <>
      <Section title="天気を表示する地点" desc="天気は Open-Meteo（無料・登録不要）から取得します。">
        <div className="form-row">
          <input className="input" style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="市区町村名で検索（例: 西宮）" onKeyDown={(e) => e.key === 'Enter' && search()} />
          <Button icon="refresh" onClick={search}>
            検索
          </Button>
        </div>
        {results && (
          <div className="search-results">
            {results.length === 0 && <span className="field-help">見つかりませんでした</span>}
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className="chip-btn"
                onClick={() => {
                  update((x) => {
                    x.location.name = r.name;
                    x.location.lat = Math.round(r.latitude * 10000) / 10000;
                    x.location.lon = Math.round(r.longitude * 10000) / 10000;
                  });
                  setResults(null);
                }}
              >
                {r.name}
                <small>
                  {r.admin1} {r.country !== '日本' ? r.country : ''}
                </small>
              </button>
            ))}
          </div>
        )}
        <div className="form-row">
          <Field label="地点名">
            <input className="input" value={d.location.name} onChange={(e) => update((x) => void (x.location.name = e.target.value))} />
          </Field>
          <Field label="緯度">
            <input className="input" type="number" step="0.0001" value={d.location.lat} onChange={(e) => update((x) => void (x.location.lat = Number(e.target.value)))} />
          </Field>
          <Field label="経度">
            <input className="input" type="number" step="0.0001" value={d.location.lon} onChange={(e) => update((x) => void (x.location.lon = Number(e.target.value)))} />
          </Field>
        </div>
      </Section>
      <Section title="警報・注意報の地域（気象庁）" desc="チラシの「地域のお店を探す」にもこの都道府県を使います。">
        <div className="form-row">
          <Field label="都道府県・地方">
            <select
              className="input"
              value={d.location.jmaOffice}
              onChange={(e) =>
                update((x) => {
                  x.location.jmaOffice = e.target.value;
                  const first = areas?.cities[e.target.value]?.[0];
                  x.location.jmaArea = first?.code ?? '';
                  x.location.jmaAreaName = first?.name ?? '';
                })
              }
            >
              {!areas && <option value={d.location.jmaOffice}>{d.location.jmaOffice}</option>}
              {areas?.offices.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="市区町村">
            <select
              className="input"
              value={d.location.jmaArea}
              onChange={(e) =>
                update((x) => {
                  x.location.jmaArea = e.target.value;
                  x.location.jmaAreaName = cities.find((c) => c.code === e.target.value)?.name ?? '';
                })
              }
            >
              {!cities.length && <option value={d.location.jmaArea}>{d.location.jmaAreaName || d.location.jmaArea}</option>}
              {cities.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// WiFi
// ---------------------------------------------------------------------------

function WifiSection({ d, update }: { d: Draft; update: Update }) {
  const [show, setShow] = useState(false);
  return (
    <Section title="WiFi の接続情報" desc="この情報は PC の data/settings.json にのみ保存され、Git には含まれません。">
      <Field label="ネットワーク名（SSID）">
        <input className="input" value={d.wifi.ssid} onChange={(e) => update((x) => void (x.wifi.ssid = e.target.value))} autoComplete="off" />
      </Field>
      <Field label="パスワード">
        <div className="form-row" style={{ margin: 0 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            type={show ? 'text' : 'password'}
            value={d.wifi.password}
            onChange={(e) => update((x) => void (x.wifi.password = e.target.value))}
            autoComplete="off"
          />
          <button type="button" className="icon-btn" aria-label="表示切り替え" onClick={() => setShow((v) => !v)}>
            <Icon name={show ? 'eyeOff' : 'eye'} />
          </button>
        </div>
      </Field>
      <Field label="セキュリティ">
        <Segmented
          value={d.wifi.encryption}
          onChange={(v) => update((x) => void (x.wifi.encryption = v))}
          options={[
            { value: 'WPA', label: 'WPA/WPA2/WPA3' },
            { value: 'WEP', label: 'WEP' },
            { value: 'nopass', label: 'なし' },
          ]}
        />
      </Field>
      <Field label="ステルス（非公開）ネットワーク">
        <Toggle checked={d.wifi.hidden} onChange={(v) => update((x) => void (x.wifi.hidden = v))} />
      </Field>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// フィード（阪神・ニュース共通）
// ---------------------------------------------------------------------------

function FeedEditor({ feeds, onChange }: { feeds: FeedSource[]; onChange(f: FeedSource[]): void }) {
  const set = (i: number, patch: Partial<FeedSource>) => onChange(feeds.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div className="row-editor">
      {feeds.map((f, i) => (
        <div key={f.id} className="row-editor-row">
          <Toggle checked={f.enabled} onChange={(v) => set(i, { enabled: v })} />
          <input className="input row-name" value={f.name} placeholder="名前" onChange={(e) => set(i, { name: e.target.value })} />
          <input className="input row-url" value={f.url} placeholder="https://…（RSS / Atom）" onChange={(e) => set(i, { url: e.target.value })} />
          <button type="button" className="icon-btn" aria-label="削除" onClick={() => onChange(feeds.filter((_, j) => j !== i))}>
            <Icon name="trash" size={18} />
          </button>
        </div>
      ))}
      <Button icon="plus" onClick={() => onChange([...feeds, { id: newId('f'), name: '', url: '', enabled: true }])}>
        フィードを追加
      </Button>
    </div>
  );
}

function TigersSection({ d, update }: { d: Draft; update: Update }) {
  return (
    <>
      <Section
        title="取得元"
        desc="公式サイトのニュース一覧と、RSS フィードをまとめて新しい順に表示します。X・Instagram・LINE の公式 API は有料・非公開のため使用していません（タイルの SNS ボタンから各アプリを開けます）。"
      >
        <Field label="阪神タイガース公式サイトのニュース">
          <Toggle checked={d.tigers.officialSite} onChange={(v) => update((x) => void (x.tigers.officialSite = v))} />
        </Field>
        <Field label="RSS フィード" help="Google ニュースの検索 RSS は個人・非営利目的での利用が許可されています">
          <FeedEditor feeds={d.tigers.feeds} onChange={(f) => update((x) => void (x.tigers.feeds = f))} />
        </Field>
      </Section>
      <Section
        title="X / Instagram を RSS で取り込む（任意・上級者向け）"
        desc={
          <>
            無料のオープンソース「RSSHub」を自分の PC で動かすと、公式 X・Instagram の投稿も取り込めます（各サービスのログイン情報の設定が必要）。空欄なら使いません。
          </>
        }
      >
        <Field label="RSSHub の URL" help="例: http://localhost:1200">
          <input className="input" value={d.tigers.rsshubBase} onChange={(e) => update((x) => void (x.tigers.rsshubBase = e.target.value))} placeholder="http://localhost:1200" />
        </Field>
        <div className="form-row">
          <Field label="X のアカウント">
            <input className="input" value={d.tigers.xAccount} onChange={(e) => update((x) => void (x.tigers.xAccount = e.target.value))} />
          </Field>
          <Field label="Instagram のアカウント">
            <input className="input" value={d.tigers.instagramAccount} onChange={(e) => update((x) => void (x.tigers.instagramAccount = e.target.value))} />
          </Field>
        </div>
      </Section>
    </>
  );
}

function NewsSection({ d, update }: { d: Draft; update: Update }) {
  return (
    <Section title="ニュースのフィード" desc="ニュースタイルの設定でジャンルを選べます。「まとめ」には有効（オン）のフィードが表示されます。">
      <FeedEditor feeds={d.news.feeds} onChange={(f) => update((x) => void (x.news.feeds = f))} />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// チラシ
// ---------------------------------------------------------------------------

function FlyersSection({ d, update }: { d: Draft; update: Update }) {
  const pref = Math.min(47, Math.max(1, parseInt(d.location.jmaOffice.slice(0, 2), 10) || 27));
  const set = (i: number, patch: Partial<FlyerStore>) => update((x) => void (x.flyers.stores = x.flyers.stores.map((s, j) => (j === i ? { ...s, ...patch } : s))));
  return (
    <Section
      title="チラシを表示するお店"
      desc={
        <>
          くふう トクバイ（無料）の店舗ページの URL を登録すると、そのお店の最新チラシを自動で表示します（3時間ごとに更新）。
          <br />
          LINEチラシは外部から取得する方法が公開されていないため、トクバイを利用しています。
        </>
      }
    >
      <div className="row-editor">
        {d.flyers.stores.map((s, i) => (
          <div key={s.id} className="row-editor-row">
            <input className="input row-name" value={s.name} placeholder="店名（空欄なら自動）" onChange={(e) => set(i, { name: e.target.value })} />
            <input className="input row-url" value={s.url} placeholder="https://tokubai.co.jp/…/12345" onChange={(e) => set(i, { url: e.target.value })} />
            <button type="button" className="icon-btn" aria-label="削除" onClick={() => update((x) => void (x.flyers.stores = x.flyers.stores.filter((_, j) => j !== i)))}>
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
        <div className="form-row">
          <Button icon="plus" onClick={() => update((x) => void x.flyers.stores.push({ id: newId('s'), name: '', url: '' }))}>
            お店を追加
          </Button>
          <Button icon="external" onClick={() => window.open(`https://tokubai.co.jp/prefectures/${pref}`, '_blank', 'noopener')}>
            地域のお店をトクバイで探す
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 予定（TimeTree）
// ---------------------------------------------------------------------------

function CalendarSection({ d, update, saved }: { d: Draft; update: Update; saved: PublicSettings }) {
  const [cals, setCals] = useState<{ id: string; name: string }[] | null>(null);
  const [msg, setMsg] = useState('');
  const loadCalendars = async () => {
    setMsg('取得中…');
    try {
      const r = await api.get<{ calendars: { id: string; name: string }[] }>('/calendar/timetree-calendars');
      setCals(r.calendars);
      setMsg('');
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const credsSaved = saved.calendar.timetreeEmail && saved.calendar.timetreePasswordSet;

  return (
    <>
      <Section
        title="TimeTree"
        desc="TimeTree の公開 API は終了しているため、Web 版と同じ方法でログインして予定を読み取ります（読み取りのみ）。パスワードは PC にだけ保存され、画面には二度と表示されません。非公式の方法のため、TimeTree 側の仕様変更で使えなくなる可能性があります。"
      >
        <Field label="メールアドレス">
          <input className="input" type="email" autoComplete="off" value={d.calendar.timetreeEmail} onChange={(e) => update((x) => void (x.calendar.timetreeEmail = e.target.value))} />
        </Field>
        <Field label="パスワード" help={d.calendar.timetreePasswordSet ? '保存済みです。変更する場合のみ入力してください。' : undefined}>
          <div className="form-row" style={{ margin: 0 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              type="password"
              autoComplete="new-password"
              placeholder={d.calendar.timetreePasswordSet ? '••••••••（保存済み）' : ''}
              value={d.calendar.timetreePassword}
              onChange={(e) => update((x) => void (x.calendar.timetreePassword = e.target.value))}
            />
            {d.calendar.timetreePasswordSet && (
              <Button
                variant="danger"
                onClick={() =>
                  update((x) => {
                    x.calendar.timetreePassword = '';
                    x.calendar.timetreePasswordSet = false;
                  })
                }
              >
                削除
              </Button>
            )}
          </div>
        </Field>
        <Field label="表示するカレンダー" help="何も選ばなければすべてのカレンダーを表示します">
          <div className="form-row" style={{ margin: 0 }}>
            <Button icon="refresh" onClick={loadCalendars} disabled={!credsSaved}>
              カレンダー一覧を取得
            </Button>
            {!credsSaved && <span className="field-help">先にメールアドレスとパスワードを保存してください</span>}
            {msg && <span className="field-help">{msg}</span>}
          </div>
          {cals && (
            <div className="check-list">
              {cals.map((c) => {
                const on = d.calendar.timetreeCalendarIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`chip-btn ${on ? 'is-on' : ''}`}
                    onClick={() =>
                      update((x) => {
                        x.calendar.timetreeCalendarIds = on ? x.calendar.timetreeCalendarIds.filter((id) => id !== c.id) : [...x.calendar.timetreeCalendarIds, c.id];
                      })
                    }
                  >
                    {on ? '✅' : '⬜'} {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </Field>
        <Field label="表示する日数">
          <input className="input input--short" type="number" min={1} max={92} value={d.calendar.days} onChange={(e) => update((x) => void (x.calendar.days = Number(e.target.value) || 31))} />
        </Field>
      </Section>
      <Section title="その他のカレンダー（iCal）" desc="Google カレンダーの「iCal 形式の非公開アドレス」など、ICS の URL を1行に1つ入力すると一緒に表示します。">
        <textarea
          className="input"
          rows={3}
          value={d.calendar.icsUrls.join('\n')}
          onChange={(e) =>
            update(
              (x) =>
                void (x.calendar.icsUrls = e.target.value
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean)),
            )
          }
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
        />
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// ゴミ出し
// ---------------------------------------------------------------------------

function GarbageSection({ d, update }: { d: Draft; update: Update }) {
  const set = (i: number, patch: Partial<GarbageRule>) => update((x) => void (x.garbage.rules = x.garbage.rules.map((r, j) => (j === i ? { ...r, ...patch } : r))));
  const toggle = (list: number[], v: number) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort());
  return (
    <Section title="ゴミの収集日" desc="第n週を1つも選ばなければ「毎週」になります。">
      <div className="row-editor">
        {d.garbage.rules.map((r, i) => (
          <div key={r.id} className="garbage-rule">
            <div className="form-row" style={{ margin: 0 }}>
              <input className="input input--icon" value={r.icon} onChange={(e) => set(i, { icon: e.target.value })} aria-label="アイコン" />
              <input className="input" style={{ flex: 1 }} value={r.name} placeholder="燃えるごみ" onChange={(e) => set(i, { name: e.target.value })} />
              <input type="color" className="color-input" value={r.color} onChange={(e) => set(i, { color: e.target.value })} aria-label="色" />
              <button type="button" className="icon-btn" aria-label="削除" onClick={() => update((x) => void (x.garbage.rules = x.garbage.rules.filter((_, j) => j !== i)))}>
                <Icon name="trash" size={18} />
              </button>
            </div>
            <div className="day-toggles">
              {WEEKDAYS.map((w, wd) => (
                <button key={w} type="button" className={r.weekdays.includes(wd) ? 'is-on' : ''} onClick={() => set(i, { weekdays: toggle(r.weekdays, wd) })}>
                  {w}
                </button>
              ))}
              <span className="day-sep" />
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={r.nths.includes(n) ? 'is-on' : ''} onClick={() => set(i, { nths: toggle(r.nths, n) })}>
                  第{n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Button
          icon="plus"
          onClick={() => update((x) => void x.garbage.rules.push({ id: newId('g'), name: '', icon: '🗑️', color: '#8b7bff', weekdays: [], nths: [] }))}
        >
          収集日を追加
        </Button>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 記念日
// ---------------------------------------------------------------------------

/**
 * 記念日の日付入力。年は手入力（空欄なら「毎年・年不明」）、月日は選択式。
 * カレンダーから選ぶこともできる。値は YYYY-MM-DD（年不明は 0000-MM-DD）。
 */
function AnnivDateInput({ value, onChange }: { value: string; onChange(v: string): void }) {
  const picker = useRef<HTMLInputElement>(null);
  const [ys = '0000', ms = '01', ds = '01'] = value.split('-');
  const year = Number(ys) || 0;
  const month = Math.min(12, Math.max(1, Number(ms) || 1));
  const day = Math.min(31, Math.max(1, Number(ds) || 1));
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const emit = (y: number, m: number, d: number) => onChange(`${pad(y, 4)}-${pad(m)}-${pad(d)}`);
  const invalidYear = year > 0 && (year < 1000 || year > 2999);

  return (
    <span className="anniv-date">
      <input
        className={`input input--year ${invalidYear ? 'is-invalid' : ''}`}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        placeholder="年（任意）"
        aria-label="年（空欄なら毎年）"
        value={year > 0 ? String(year) : ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9０-９]/g, '').replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10)).slice(0, 4);
          emit(digits ? Number(digits) : 0, month, day);
        }}
      />
      <span className="anniv-date-sep">年</span>
      <select className="input input--md" aria-label="月" value={month} onChange={(e) => emit(year, Number(e.target.value), day)}>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
      <span className="anniv-date-sep">月</span>
      <select className="input input--md" aria-label="日" value={day} onChange={(e) => emit(year, month, Number(e.target.value))}>
        {Array.from({ length: 31 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
      <span className="anniv-date-sep">日</span>
      <span className="anniv-picker">
        <span aria-hidden="true">📅</span>
        <input
          ref={picker}
          type="date"
          aria-label="カレンダーから選ぶ"
          value={year >= 1000 ? `${pad(year, 4)}-${pad(month)}-${pad(day)}` : ''}
          onClick={() => {
            try {
              picker.current?.showPicker?.();
            } catch {
              /* 対応していないブラウザではそのまま */
            }
          }}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </span>
    </span>
  );
}

function AnnivSection({ d, update }: { d: Draft; update: Update }) {
  const set = (i: number, patch: Partial<Anniversary>) =>
    update((x) => void (x.anniversaries.items = x.anniversaries.items.map((a, j) => (j === i ? { ...a, ...patch } : a))));
  return (
    <Section
      title="誕生日・記念日"
      desc="年は手で入力できます（4桁・例: 2020）。誕生日は生まれ年を入れると年齢も表示します。年を空欄にすると、毎年くる日として表示します。📅 からカレンダーで選ぶこともできます。"
    >
      <div className="row-editor">
        {d.anniversaries.items.map((a, i) => {
          return (
            <div key={a.id} className="row-editor-row">
              <input className="input input--icon" value={a.icon} onChange={(e) => set(i, { icon: e.target.value })} aria-label="アイコン" />
              <input className="input row-name" value={a.name} placeholder="名前" onChange={(e) => set(i, { name: e.target.value })} />
              <AnnivDateInput value={a.date} onChange={(date) => set(i, { date })} />
              <select className="input input--kind" value={a.kind} onChange={(e) => set(i, { kind: e.target.value as Anniversary['kind'] })}>
                <option value="birthday">誕生日</option>
                <option value="anniversary">記念日</option>
                <option value="event">イベント</option>
              </select>
              <button
                type="button"
                className="icon-btn"
                aria-label="削除"
                onClick={() => update((x) => void (x.anniversaries.items = x.anniversaries.items.filter((_, j) => j !== i)))}
              >
                <Icon name="trash" size={18} />
              </button>
            </div>
          );
        })}
        <Button
          icon="plus"
          onClick={() => update((x) => void x.anniversaries.items.push({ id: newId('a'), name: '', date: '0000-01-01', kind: 'birthday', icon: '🎂' }))}
        >
          追加
        </Button>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// ショートカット
// ---------------------------------------------------------------------------

function ShortcutsSection({ d, update }: { d: Draft; update: Update }) {
  const items = d.shortcuts.items;
  const set = (i: number, patch: Partial<Shortcut>) => update((x) => void (x.shortcuts.items = x.shortcuts.items.map((s, j) => (j === i ? { ...s, ...patch } : s))));
  const move = (i: number, dir: -1 | 1) =>
    update((x) => {
      const list = [...x.shortcuts.items];
      const j = i + dir;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      x.shortcuts.items = list;
    });
  return (
    <Section
      title="ショートカット"
      desc={
        <>
          ショートカットタイルに並べるボタンです。https:// で始まるURLのほか、アプリ独自のURL（例: youtube://）も登録できます。
          <br />
          iPad では、アプリがインストールされていれば https:// のリンクからアプリが開くこともあります（アプリによって異なります）。
        </>
      }
    >
      <div className="row-editor">
        {items.map((s, i) => (
          <div key={s.id} className="row-editor-row">
            <input className="input input--icon" value={s.icon} onChange={(e) => set(i, { icon: e.target.value })} aria-label="アイコン" />
            <input className="input row-name" value={s.name} placeholder="名前" onChange={(e) => set(i, { name: e.target.value })} />
            <input className="input row-url" value={s.url} placeholder="https://…" onChange={(e) => set(i, { url: e.target.value })} />
            <input type="color" className="color-input" value={s.color || '#8b7bff'} onChange={(e) => set(i, { color: e.target.value })} aria-label="色" />
            <button type="button" className="icon-btn" aria-label="上へ" onClick={() => move(i, -1)} disabled={i === 0}>
              <Icon name="chevronLeft" size={16} style={{ transform: 'rotate(90deg)' }} />
            </button>
            <button type="button" className="icon-btn" aria-label="削除" onClick={() => update((x) => void (x.shortcuts.items = x.shortcuts.items.filter((_, j) => j !== i)))}>
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
        <Button icon="plus" onClick={() => update((x) => void x.shortcuts.items.push({ id: newId('sc'), name: '', icon: '🔗', url: '', color: '#8b7bff' }))}>
          ショートカットを追加
        </Button>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 写真
// ---------------------------------------------------------------------------

function PhotosSection({ d, update }: { d: Draft; update: Update }) {
  const { data } = useRemote<{ dir: string; files: unknown[] }>('/photos', 60_000);
  return (
    <Section title="フォトフレーム" desc="PC のフォルダにある写真（jpg / png / webp / heic など）をスライドショーで表示します。">
      <Field label="写真フォルダ（PC 上のパス）" help={`空欄なら既定のフォルダを使います。現在: ${data?.dir ?? '…'}（${data?.files.length ?? 0}枚）`}>
        <input className="input" value={d.photos.dir} onChange={(e) => update((x) => void (x.photos.dir = e.target.value))} placeholder="C:\Users\…\Pictures\Family" />
      </Field>
      <Field label="切り替え間隔（秒）">
        <input className="input input--short" type="number" min={3} value={d.photos.intervalSec} onChange={(e) => update((x) => void (x.photos.intervalSec = Number(e.target.value) || 15))} />
      </Field>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// データ管理（エクスポート / インポート）
// ---------------------------------------------------------------------------

/** スマホのリモコン画面を開く QR コード */
function RemoteQr({ urls }: { urls?: string[] }) {
  const [svg, setSvg] = useState('');
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const base = local ? urls?.[0] : location.origin;
  const url = base ? `${base}/remote` : '';
  useEffect(() => {
    if (!url) return;
    void QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#0b0d14', light: '#ffffff' } }).then(setSvg);
  }, [url]);
  if (!url) return null;
  return (
    <div className="remote-qr">
      <div className="remote-qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
      <div>
        <p>スマホのカメラで読み取ると、リモコン画面が開きます。</p>
        <p className="mono">{url}</p>
        <p className="field-help">ページ切り替え・画面を暗くする・タスクや買い物リストの編集・各種設定ができます。</p>
      </div>
    </div>
  );
}

function DataSection() {
  const [secrets, setSecrets] = useState(false);
  const [bundle, setBundle] = useState<ExportBundle | null>(null);
  const [sections, setSections] = useState<string[]>(['settings', 'layout', 'boards']);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: health } = useRemote<{ version: string; dataDir: string; urls: string[] }>('/health', 60_000);

  const onFile = async (file: File) => {
    setMsg('');
    try {
      const json = JSON.parse(await file.text()) as ExportBundle;
      if (json.app !== 'home-information') throw new Error('Home Information のエクスポートファイルではありません');
      setBundle(json);
    } catch (e) {
      setBundle(null);
      setMsg(`読み込めませんでした: ${(e as Error).message}`);
    }
  };

  const doImport = async () => {
    if (!bundle) return;
    if (!window.confirm('現在の内容を上書きします。よろしいですか？')) return;
    try {
      await api.importBundle(bundle, sections);
      setMsg('インポートしました。画面を再読み込みします…');
      try {
        localStorage.removeItem('hi:layout');
        localStorage.removeItem('hi:settings');
      } catch {
        /* noop */
      }
      window.setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setMsg(`インポートに失敗しました: ${(e as Error).message}`);
    }
  };

  const labels: Record<string, string> = { settings: '設定（地域・WiFi・取得元など）', layout: 'レイアウト（全端末分）', boards: '伝言板・タスク・買い物リスト' };

  return (
    <>
      <Section title="エクスポート" desc="設定・レイアウト・伝言板などを1つの JSON ファイルに書き出します。バックアップや別の PC への移行に使えます。">
        <Field label="WiFi・TimeTree のパスワードも含める" help="含める場合はファイルの取り扱いに注意してください">
          <Toggle checked={secrets} onChange={setSecrets} />
        </Field>
        <div>
          <a className="btn btn--primary" href={api.exportUrl(secrets)} download>
            <Icon name="download" size={18} /> エクスポート（.json）
          </a>
        </div>
      </Section>
      <Section title="インポート" desc="エクスポートしたファイルを読み込んで復元します。">
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
        <div>
          <Button icon="upload" onClick={() => fileRef.current?.click()}>
            ファイルを選ぶ
          </Button>
        </div>
        {bundle && (
          <div className="import-box">
            <div>
              📄 {new Date(bundle.exportedAt).toLocaleString('ja-JP')} にエクスポート
              {bundle.includesSecrets ? '（パスワードを含む）' : '（パスワードは現在の値を維持）'}
            </div>
            {Object.entries(labels).map(([k, label]) => (
              <label key={k} className="inline-check">
                <input type="checkbox" checked={sections.includes(k)} onChange={(e) => setSections((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))} />
                {label}
              </label>
            ))}
            <div>
              <Button variant="danger" icon="upload" onClick={doImport} disabled={!sections.length}>
                インポートして上書き
              </Button>
            </div>
          </div>
        )}
        {msg && <p className="field-help">{msg}</p>}
      </Section>
      <Section title="スマホのリモコン">
        <RemoteQr urls={health?.urls} />
      </Section>
      <Section title="PC サーバー">
        <dl className="info-list">
          <dt>保存先</dt>
          <dd className="mono">{health?.dataDir ?? '…'}</dd>
          <dt>iPad から開く URL</dt>
          <dd className="mono">{health?.urls.map((u) => <div key={u}>{u}</div>) ?? '…'}</dd>
          <dt>バージョン</dt>
          <dd>{health?.version ?? '…'}</dd>
        </dl>
      </Section>
    </>
  );
}

function AboutSection() {
  return (
    <>
      <Section title="使い方">
        <ul className="help-list">
          <li>
            <b>編集モード</b>：タイルや空いている場所を長押し（または右下の <Icon name="grid" size={14} /> ボタン）
          </li>
          <li>
            <b>移動</b>：編集モードでタイルをドラッグ。画面の端で少し止めると隣のページへ移動
          </li>
          <li>
            <b>サイズ変更</b>：右下の角をドラッグ。中身は大きさに合わせて自動で最適化されます
          </li>
          <li>
            <b>タイルの設定</b>：編集モードで右上の <Icon name="sliders" size={14} /> ボタン（表示内容・色・文字の大きさ）
          </li>
          <li>
            <b>ページ</b>：左右にスワイプして切り替え。編集バーの「ページ追加」で増やせます
          </li>
          <li>
            <b>iPad で全画面</b>：Safari の共有ボタン →「ホーム画面に追加」
          </li>
        </ul>
      </Section>
      <Section title="情報源（すべて無料・API キー不要）">
        <ul className="help-list">
          <li>天気: Open-Meteo（非営利利用は無料）</li>
          <li>警報・注意報・雨雲レーダー: 気象庁ホームページ</li>
          <li>地図: 国土地理院 地理院タイル</li>
          <li>阪神タイガース: 球団公式サイト、Google ニュース RSS</li>
          <li>ニュース: Yahoo!ニュース トピックス RSS</li>
          <li>チラシ: くふう トクバイ（店舗ページ）</li>
          <li>予定: TimeTree（Web 版の非公式 API）、iCal</li>
          <li>祝日: 内閣府の規定に基づきアプリ内で計算</li>
        </ul>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------

export default function SettingsSheet({ onClose }: { onClose(): void }) {
  const saved = useApp((s) => s.settings);
  const saveSettings = useApp((s) => s.saveSettings);
  const toast = useApp((s) => s.toast);
  const [draft, setDraft] = useState<Draft>(() => structuredClone(saved));
  const [section, setSection] = useState<SectionId>('display');
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const update: Update = (fn) =>
    setDraft((d) => {
      const next = structuredClone(d);
      fn(next);
      return next;
    });

  // テーマはプレビューとしてすぐに反映し、閉じたら保存済みの値に戻す
  useEffect(() => {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
    applyTheme(resolveTheme(draft.appearance.theme, dark), draft.appearance.wallpaper);
  }, [draft.appearance.theme, draft.appearance.wallpaper]);
  useEffect(
    () => () => {
      const s = useApp.getState().settings.appearance;
      const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
      applyTheme(resolveTheme(s.theme, dark), s.wallpaper);
    },
    [],
  );

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(draft);
      setDraft(structuredClone(useApp.getState().settings));
      toast('設定を PC に保存しました');
    } catch (e) {
      toast(`保存できませんでした: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (dirty && !window.confirm('保存していない変更があります。破棄して閉じますか？')) return;
    onClose();
  };

  const props = { d: draft, update };
  return (
    <Sheet
      title="設定"
      onClose={close}
      size="full"
      footer={
        <>
          <span className="settings-status">{dirty ? '未保存の変更があります' : '設定は PC に保存されています'}</span>
          <Button variant="ghost" onClick={close}>
            閉じる
          </Button>
          <Button variant="primary" icon="check" onClick={save} disabled={!dirty || saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </>
      }
    >
      <div className="settings">
        <nav className="settings-nav">
          {SECTIONS.map((s) => (
            <button key={s.id} type="button" className={section === s.id ? 'is-active' : ''} onClick={() => setSection(s.id)}>
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {section === 'display' && <DisplaySection {...props} />}
          {section === 'region' && <RegionSection {...props} />}
          {section === 'wifi' && <WifiSection {...props} />}
          {section === 'tigers' && <TigersSection {...props} />}
          {section === 'news' && <NewsSection {...props} />}
          {section === 'flyers' && <FlyersSection {...props} />}
          {section === 'calendar' && <CalendarSection {...props} saved={saved} />}
          {section === 'garbage' && <GarbageSection {...props} />}
          {section === 'anniv' && <AnnivSection {...props} />}
          {section === 'shortcuts' && <ShortcutsSection {...props} />}
          {section === 'photos' && <PhotosSection {...props} />}
          {section === 'data' && <DataSection />}
          {section === 'about' && <AboutSection />}
        </div>
      </div>
    </Sheet>
  );
}
