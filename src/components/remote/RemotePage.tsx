import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DisplayInfo, RemoteCommand } from '../../../shared/types';
import { api } from '../../api/client';
import { useRemote } from '../../hooks/useRemote';
import { useApp } from '../../state/store';
import { getTileDef } from '../../tiles/registry';
import { Icon } from '../icons';
import { TileErrorBoundary, TileSizeContext, makeSizeInfo } from '../tileKit';
import './remote.css';

const SettingsSheet = lazy(() => import('../settings/SettingsSheet'));

type Tab = 'screen' | 'lists' | 'settings';

const PROFILE_LABEL: Record<string, string> = {
  'tablet-landscape': '横向き',
  'tablet-portrait': '縦向き',
  phone: 'スマホ',
};

/** タイルをそのまま埋め込んで表示する（リスト・伝言板などをスマホから操作するため） */
function TilePreview({ type, props, height }: { type: string; props?: Record<string, unknown>; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const def = getTileDef(type);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!def) return null;
  const Comp = def.component;
  return (
    <div ref={ref} className={`tile tile-preview tile--${type} surface-glass`} style={{ height }}>
      <div className="tile-body">
        <TileSizeContext.Provider value={makeSizeInfo(width, height, 4, 4)}>
          <TileErrorBoundary resetKey={type}>
            <Comp tile={{ id: `remote-${type}`, type, x: 0, y: 0, w: 4, h: 4 }} props={{ ...(def.defaultProps ?? {}), ...(props ?? {}) }} />
          </TileErrorBoundary>
        </TileSizeContext.Provider>
      </div>
    </div>
  );
}

/** メイン画面（全ての表示端末）のロック切り替え */
function LockCard() {
  const locked = useApp((s) => s.settings.lock?.enabled === true);
  const sync = useApp((s) => s.syncFromServer);
  const toast = useApp((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await api.setLock(!locked);
      await sync();
      toast(!locked ? '🔒 メイン画面をロックしました' : '🔓 ロックを解除しました');
    } catch (e) {
      toast(`切り替えられませんでした: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rc-section">
      <button type="button" className={`rc-lock ${locked ? 'is-locked' : ''}`} onClick={() => void toggle()} disabled={busy}>
        <span className="rc-lock-icon">{locked ? '🔒' : '🔓'}</span>
        <span className="rc-lock-text">
          <b>{locked ? 'メイン画面はロック中' : 'メイン画面のロック：オフ'}</b>
          <small>{locked ? '編集・設定はできません。タップで解除' : 'タップすると、編集や設定ができないようにします'}</small>
        </span>
        <span className={`toggle-track ${locked ? 'is-on' : ''}`}>
          <span className="toggle-thumb" />
        </span>
      </button>
    </section>
  );
}

function ScreenTab() {
  const { data, reload } = useRemote<{ displays: DisplayInfo[] }>('/remote/displays', 4_000);
  const toast = useApp((s) => s.toast);
  const displays = useMemo(() => data?.displays ?? [], [data]);
  const [selected, setSelected] = useState<string>('');
  const target = displays.find((d) => d.id === selected) ?? displays[0];

  useEffect(() => {
    if (!selected && displays[0]) setSelected(displays[0].id);
  }, [selected, displays]);

  const send = async (command: RemoteCommand, to = target?.id ?? 'all') => {
    try {
      const r = await fetch('/api/remote/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: to, command }),
      }).then((x) => x.json() as Promise<{ delivered?: number; error?: string }>);
      if (r.error) throw new Error(r.error);
      if (!r.delivered) toast('端末に届きませんでした（画面が閉じている可能性があります）', 'error');
      window.setTimeout(reload, 600);
    } catch (e) {
      toast(`送信できませんでした: ${(e as Error).message}`, 'error');
    }
  };

  if (!data) return <p className="rc-empty">読み込み中…</p>;
  if (!displays.length) {
    return (
      <>
      <LockCard />
      <div className="rc-empty">
        <p>📺 表示中の端末が見つかりません</p>
        <p className="rc-sub">iPad などで Home Information を開くと、ここに表示されます。</p>
      </div>
      </>
    );
  }

  return (
    <>
      <LockCard />
      <section className="rc-section">
        <h2>操作する端末</h2>
        <div className="rc-chips">
          {displays.map((d) => (
            <button key={d.id} type="button" className={`rc-chip ${target?.id === d.id ? 'is-active' : ''}`} onClick={() => setSelected(d.id)}>
              <span className={`rc-dot ${d.connected ? 'is-on' : ''}`} />
              {d.name}
              <small>{PROFILE_LABEL[d.profile] ?? ''}</small>
            </button>
          ))}
        </div>
      </section>

      {target && (
        <>
          <section className="rc-section">
            <h2>
              ページ
              <span className="rc-page-count">
                {target.page + 1} / {target.pageCount}
              </span>
            </h2>
            <div className="rc-pager">
              <button type="button" className="rc-big" aria-label="前のページ" onClick={() => void send({ type: 'prev' })} disabled={target.page <= 0}>
                <Icon name="chevronLeft" size={28} />
              </button>
              <button type="button" className="rc-big" aria-label="次のページ" onClick={() => void send({ type: 'next' })} disabled={target.page >= target.pageCount - 1}>
                <Icon name="chevronRight" size={28} />
              </button>
            </div>
            <div className="rc-pages">
              {Array.from({ length: target.pageCount }, (_, i) => (
                <button key={i} type="button" className={`rc-page ${i === target.page ? 'is-active' : ''}`} onClick={() => void send({ type: 'goto', page: i })}>
                  <b>{i + 1}</b>
                  <span>{target.pages[i] || '（空のページ）'}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rc-section">
            <h2>画面</h2>
            <div className="rc-actions">
              <button type="button" className="rc-action" onClick={() => void send({ type: target.dim ? 'undim' : 'dim' })}>
                <span>{target.dim ? '☀️' : '🌙'}</span>
                {target.dim ? '明るくする' : '暗くする'}
              </button>
              <button type="button" className="rc-action" onClick={() => void send({ type: 'identify' })}>
                <span>📣</span>
                呼び出す
              </button>
              <button type="button" className="rc-action" onClick={() => void send({ type: 'reload' })}>
                <span>🔄</span>
                再読み込み
              </button>
              <button type="button" className="rc-action" onClick={() => void send({ type: 'dim' }, 'all')}>
                <span>🌃</span>
                全部暗くする
              </button>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function ListsTab() {
  const refresh = useApp((s) => s.refreshBoards);
  const layout = useApp((s) => s.layout);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  // 表示端末に置かれているコドモンタイルの設定（チェック項目）を使う
  const codmon = Object.values(layout.profiles)
    .flatMap((p) => p?.pages.flatMap((pg) => pg.tiles) ?? [])
    .find((t) => t.type === 'codmon');

  return (
    <div className="rc-lists">
      {codmon && <TilePreview type="codmon" props={codmon.props} height={300} />}
      <TilePreview type="tasks" height={380} />
      <TilePreview type="shopping" height={420} />
      <TilePreview type="memo" height={340} />
    </div>
  );
}

export default function RemotePage() {
  const [tab, setTab] = useState<Tab>('screen');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 他の端末での変更を定期的に反映
  const sync = useApp((s) => s.syncFromServer);
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === 'visible' && void sync(), 20_000);
    return () => window.clearInterval(t);
  }, [sync]);

  return (
    <div className="rc">
      <header className="rc-header">
        <span className="rc-logo">🎮</span>
        <div>
          <h1>リモコン</h1>
          <p>Home Information</p>
        </div>
        <a className="icon-btn" href="/" aria-label="ホーム画面を表示" title="この端末でホーム画面を表示">
          <Icon name="grid" size={18} />
        </a>
      </header>

      <main className="rc-main">
        {tab === 'screen' && <ScreenTab />}
        {tab === 'lists' && <ListsTab />}
        {tab === 'settings' && (
          <div className="rc-settings">
            <p className="rc-sub">地域・WiFi・ニュースの取得元・チラシのお店・TimeTree・ゴミ出し・記念日などを設定できます。保存すると全ての端末に反映されます。</p>
            <button type="button" className="btn btn--primary rc-wide" onClick={() => setSettingsOpen(true)}>
              <Icon name="gear" size={18} /> 設定を開く
            </button>
            <a className="btn rc-wide" href={api.exportUrl(false)} download>
              <Icon name="download" size={18} /> 設定をバックアップ（エクスポート）
            </a>
          </div>
        )}
      </main>

      <nav className="rc-tabs">
        {(
          [
            ['screen', '📺', '画面'],
            ['lists', '📝', 'リスト'],
            ['settings', '⚙️', '設定'],
          ] as const
        ).map(([id, icon, label]) => (
          <button key={id} type="button" className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsSheet onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
