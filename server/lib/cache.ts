interface Entry {
  value: unknown;
  expires: number;
}

/**
 * 外部サイトへのアクセスを減らすための TTL キャッシュ。
 * 取得に失敗した場合は期限切れの値（あれば）を返して表示を維持する。
 */
export class TtlCache {
  private entries = new Map<string, Entry>();
  private inflight = new Map<string, Promise<unknown>>();

  async get<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && hit.expires > now) return hit.value as T;

    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = loader()
      .then((value) => {
        this.entries.set(key, { value, expires: Date.now() + ttlMs });
        return value;
      })
      .catch((err) => {
        if (hit) {
          console.warn(`[cache] ${key} の取得に失敗したため前回の値を使用します:`, (err as Error).message);
          // 連続失敗で外部サイトを叩き続けないよう少し延命する
          this.entries.set(key, { value: hit.value, expires: Date.now() + Math.min(ttlMs, 60_000) });
          return hit.value as T;
        }
        throw err;
      })
      .finally(() => this.inflight.delete(key));

    this.inflight.set(key, promise);
    return promise;
  }

  clear(prefix = ''): void {
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }
}
