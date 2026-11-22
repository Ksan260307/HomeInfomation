import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * PC ローカルの JSON ファイルを読み書きする小さなストア。
 * - 書き込みは直列化し、一時ファイル → リネームで原子的に置き換える
 * - 上書き前の内容は *.bak として 1 世代残す
 */
export class JsonStore<T> {
  private cache: T | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    readonly file: string,
    private readonly fallback: () => T,
    private readonly normalize: (raw: unknown) => T = (raw) => raw as T,
  ) {}

  async read(): Promise<T> {
    if (this.cache) return this.cache;
    try {
      const text = await fs.readFile(this.file, 'utf8');
      this.cache = this.normalize(JSON.parse(text));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[storage] ${path.basename(this.file)} を読み込めませんでした。既定値を使用します:`, err);
      }
      this.cache = this.fallback();
    }
    return this.cache;
  }

  write(value: T): Promise<T> {
    return this.update(() => value);
  }

  /** 読み取り→変更→保存 を他の書き込みと競合しないように実行する */
  update(fn: (current: T) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const current = await this.read();
      const next = this.normalize(await fn(structuredClone(current)));
      await this.persist(next);
      this.cache = next;
      return next;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async persist(value: T): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const json = JSON.stringify(value, null, 2);
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, json, 'utf8');
    try {
      await fs.copyFile(this.file, `${this.file}.bak`);
    } catch {
      // 初回は元ファイルが無いので無視
    }
    try {
      await fs.rename(tmp, this.file);
    } catch {
      // Windows でウイルス対策ソフト等がファイルを掴んでいる場合のフォールバック
      await fs.writeFile(this.file, json, 'utf8');
      await fs.rm(tmp, { force: true });
    }
  }
}
