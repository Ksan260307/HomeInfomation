import { lazy, Suspense, useEffect, useState } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { useDisplayRemote } from './hooks/useDisplayRemote';
import { isRemoteMode } from './lib/device';
import { useNow } from './hooks/useNow';
import { activeProfileId, detectProfile, useApp } from './state/store';
import { applyTheme, resolveTheme } from './themes/themes';

const SettingsSheet = lazy(() => import('./components/settings/SettingsSheet'));
const RemotePage = lazy(() => import('./components/remote/RemotePage'));

/** 表示端末としてリモコンの命令を受け取る */
function DisplayRemoteBridge({ dimmed }: { dimmed: boolean }) {
  useDisplayRemote(dimmed);
  return null;
}

function usePrefersDark() {
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark;
}

/** 画面スリープを防ぐ（対応ブラウザのみ。iPad はホーム画面に追加したアプリで iPadOS 18.4 以降） */
function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if (document.visibilityState === 'visible' && !lock) {
          lock = await navigator.wakeLock.request('screen');
          lock.addEventListener('release', () => (lock = null));
        }
      } catch {
        /* ユーザー操作が必要な場合などは無視 */
      }
    };
    void request();
    document.addEventListener('visibilitychange', request);
    window.addEventListener('pointerdown', request);
    return () => {
      document.removeEventListener('visibilitychange', request);
      window.removeEventListener('pointerdown', request);
      void lock?.release();
    };
  }, [enabled]);
}

function inNightWindow(now: Date, start: string, end: string) {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const cur = now.getHours() * 60 + now.getMinutes();
  const a = toMin(start);
  const b = toMin(end);
  return a <= b ? cur >= a && cur < b : cur >= a || cur < b;
}

export default function App() {
  const ready = useApp((s) => s.ready);
  const init = useApp((s) => s.init);
  const sync = useApp((s) => s.syncFromServer);
  const appearance = useApp((s) => s.settings.appearance);
  const serverOnline = useApp((s) => s.serverOnline);
  const toasts = useApp((s) => s.toasts);
  const setAutoProfile = useApp((s) => s.setAutoProfile);
  const profileId = useApp(activeProfileId);
  const hasProfile = useApp((s) => !!s.layout.profiles[activeProfileId(s)]);
  const updateProfile = useApp((s) => s.updateProfile);
  const editMode = useApp((s) => s.editMode);
  const prefersDark = usePrefersDark();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const now = new Date(useNow(60_000));
  const remoteDim = useApp((s) => s.remoteDim);
  const wakeUntil = useApp((s) => s.wakeUntil);
  const setRemoteDim = useApp((s) => s.setRemoteDim);
  const [remote] = useState(isRemoteMode);
  const locked = useApp((s) => s.settings.lock?.enabled === true);

  useEffect(() => {
    void init();
  }, [init]);

  // 他の端末での変更（レイアウト・設定）を定期的に反映
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === 'visible' && void sync(), 30_000);
    return () => window.clearInterval(t);
  }, [sync]);

  // 端末の向き・サイズに合わせてレイアウトを切り替える
  useEffect(() => {
    const on = () => setAutoProfile(detectProfile(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, [setAutoProfile]);

  // このプロファイル用のレイアウトがまだ無ければ自動生成して保存
  useEffect(() => {
    if (ready && !hasProfile && !remote) updateProfile((p) => p);
  }, [ready, hasProfile, profileId, updateProfile, remote]);

  useEffect(() => {
    applyTheme(resolveTheme(appearance.theme, prefersDark), appearance.wallpaper);
  }, [appearance.theme, appearance.wallpaper, prefersDark]);

  useWakeLock(appearance.keepAwake && !remote);

  // 夜間・リモコン指示で画面を暗くする（タップで1分間解除）
  const night = appearance.nightDim && inNightWindow(now, appearance.nightStart, appearance.nightEnd) && Date.now() > wakeUntil;
  const dimmed = (remoteDim || night) && !editMode && !settingsOpen;

  if (!ready) return <div className="app splash">Home Information</div>;

  const toastView = (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast glass ${t.kind === 'error' ? 'is-error' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );

  if (remote) {
    return (
      <div className="app app--remote">
        <Suspense fallback={null}>
          <RemotePage />
        </Suspense>
        {toastView}
      </div>
    );
  }

  return (
    <div className="app" onPointerDown={dimmed ? () => setRemoteDim(false, 60_000) : undefined}>
      <DisplayRemoteBridge dimmed={dimmed} />
      <HomeScreen onOpenSettings={() => !locked && setSettingsOpen(true)} locked={locked} />
      {!serverOnline && <div className="offline-badge">PC のサーバーに接続できません（オフライン表示中）</div>}
      {dimmed && <div className={`night-dim ${remoteDim ? 'is-deep' : ''}`} />}
      {settingsOpen && !locked && (
        <Suspense fallback={null}>
          <SettingsSheet onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
      {toastView}
    </div>
  );
}
