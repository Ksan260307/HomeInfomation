import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api } from '../api/client';

/**
 * サーバー API をポーリングする小さなデータ取得フック。
 * 同じパスを複数のタイルが使っても通信は1回にまとめる。
 */
interface Entry {
  data?: unknown;
  error?: string;
  at: number;
  loading: boolean;
}

const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<void>>();

function emit(path: string) {
  listeners.get(path)?.forEach((l) => l());
}

function load(path: string): Promise<void> {
  const running = inflight.get(path);
  if (running) return running;
  const prev = entries.get(path);
  entries.set(path, { ...(prev ?? { at: 0 }), loading: true });
  emit(path);
  const p = api
    .get<unknown>(path)
    .then((data) => {
      entries.set(path, { data, at: Date.now(), loading: false });
    })
    .catch((err: Error) => {
      // 失敗しても直前のデータは残して表示を続ける
      entries.set(path, { data: prev?.data, error: err.message, at: Date.now(), loading: false });
    })
    .finally(() => {
      inflight.delete(path);
      emit(path);
    });
  inflight.set(path, p);
  return p;
}

function subscribe(path: string, cb: () => void) {
  let set = listeners.get(path);
  if (!set) listeners.set(path, (set = new Set()));
  set.add(cb);
  return () => {
    set.delete(cb);
  };
}

const EMPTY: Entry = { at: 0, loading: true };

export interface RemoteState<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  updatedAt: number;
  reload: () => void;
}

export function useRemote<T>(path: string | null, intervalMs: number): RemoteState<T> {
  const entry = useSyncExternalStore(
    useCallback((cb: () => void) => (path ? subscribe(path, cb) : () => undefined), [path]),
    () => (path ? (entries.get(path) ?? EMPTY) : EMPTY),
  );

  useEffect(() => {
    if (!path) return;
    const refreshIfStale = () => {
      const e = entries.get(path);
      if (!e || Date.now() - e.at > intervalMs * 0.9) void load(path);
    };
    refreshIfStale();
    const timer = window.setInterval(refreshIfStale, Math.max(5_000, intervalMs / 4));
    const onVisible = () => document.visibilityState === 'visible' && refreshIfStale();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refreshIfStale);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refreshIfStale);
    };
  }, [path, intervalMs]);

  const reload = useCallback(() => {
    if (path) void load(path);
  }, [path]);

  return { data: entry.data as T | undefined, error: entry.error, loading: entry.loading, updatedAt: entry.at, reload };
}

/** 設定変更時などにキャッシュを捨てて再取得させる */
export function invalidateRemote(prefix = '') {
  for (const path of [...entries.keys()]) {
    if (!path.startsWith(prefix)) continue;
    entries.delete(path);
    if (listeners.get(path)?.size) void load(path);
  }
}
