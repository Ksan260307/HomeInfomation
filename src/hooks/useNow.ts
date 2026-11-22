import { useCallback, useSyncExternalStore } from 'react';

/**
 * 全タイルで共有する時刻。間隔ごとにタイマーを1つだけ動かし、境界（秒・分）に合わせて更新する。
 */
interface Ticker {
  now: number;
  listeners: Set<() => void>;
  timer?: number;
}

const tickers = new Map<number, Ticker>();

function getTicker(interval: number): Ticker {
  let t = tickers.get(interval);
  if (!t) {
    t = { now: Date.now(), listeners: new Set() };
    tickers.set(interval, t);
  }
  return t;
}

function schedule(interval: number, t: Ticker) {
  t.timer = window.setTimeout(
    () => {
      t.now = Date.now();
      t.listeners.forEach((l) => l());
      schedule(interval, t);
    },
    interval - (Date.now() % interval) + 5,
  );
}

function subscribeTicker(interval: number, cb: () => void) {
  const t = getTicker(interval);
  t.listeners.add(cb);
  if (t.timer === undefined) {
    // 停止していたタイマーを再開するときは時刻を最新にしてから通知する
    const fresh = Date.now();
    if (fresh - t.now >= interval) {
      t.now = fresh;
      queueMicrotask(() => t.listeners.forEach((l) => l()));
    }
    schedule(interval, t);
  }
  return () => {
    t.listeners.delete(cb);
    if (t.listeners.size === 0 && t.timer !== undefined) {
      window.clearTimeout(t.timer);
      t.timer = undefined;
    }
  };
}

export function useNow(interval = 1000): number {
  const subscribe = useCallback((cb: () => void) => subscribeTicker(interval, cb), [interval]);
  const getSnapshot = useCallback(() => getTicker(interval).now, [interval]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
