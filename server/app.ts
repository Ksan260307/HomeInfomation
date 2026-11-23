import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_SETTINGS, EMPTY_BOARDS, EMPTY_LAYOUT, newId, normalizeSettings } from '../shared/defaults';
import type {
  AppSettings,
  BoardsState,
  CalendarEvent,
  CalendarResponse,
  ExportBundle,
  FeedItem,
  FeedResponse,
  FlyerResponse,
  LayoutState,
  ListItem,
  PublicSettings,
  RemoteCommand,
  WarningResponse,
} from '../shared/types';
import { TtlCache } from './lib/cache';
import { fetchJson, fetchText, isHttpUrl } from './lib/http';
import { parseIcs } from './lib/ics';
import { buildAreaList, parseWarnings, type AreaList } from './lib/jma';
import { normalizeBoards, normalizeLayout } from './lib/normalize';
import { mergeFeedItems, parseFeed } from './lib/rss';
import { TIGERS_OFFICIAL_NEWS_URL, extractFlyers, parseTigersOfficial } from './lib/scrape';
import { RemoteHub } from './lib/remote';
import { JsonStore } from './lib/storage';
import { TimeTreeClient, expandTimeTreeEvents, type TimeTreeCalendarInfo } from './lib/timetree';

export interface AppOptions {
  dataDir: string;
  /** ビルド済みのフロントエンド（dist/web）。開発時は Vite が配信するので不要 */
  webDir?: string;
  version?: string;
}

const MIN = 60_000;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|avif)$/i;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function toPublic(s: AppSettings): PublicSettings {
  const copy = structuredClone(s) as PublicSettings;
  copy.calendar.timetreePasswordSet = !!s.calendar.timetreePassword;
  copy.calendar.timetreePassword = '';
  return copy;
}

function startOfTodayJst(now = Date.now()): number {
  const jst = now + 9 * 3600_000;
  return jst - (jst % 86400_000) - 9 * 3600_000;
}

export function lanUrls(port: number): string[] {
  const urls: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) urls.push(`http://${ni.address}:${port}`);
    }
  }
  return urls;
}

export function createApp(opts: AppOptions) {
  const { dataDir } = opts;
  const settingsStore = new JsonStore<AppSettings>(path.join(dataDir, 'settings.json'), () => structuredClone(DEFAULT_SETTINGS), normalizeSettings);
  const layoutStore = new JsonStore<LayoutState>(path.join(dataDir, 'layout.json'), () => structuredClone(EMPTY_LAYOUT), normalizeLayout);
  const boardsStore = new JsonStore<BoardsState>(path.join(dataDir, 'boards.json'), () => structuredClone(EMPTY_BOARDS), normalizeBoards);
  const cache = new TtlCache();
  const remote = new RemoteHub();
  let timetree: { key: string; client: TimeTreeClient } | null = null;

  const getTimeTree = (s: AppSettings): TimeTreeClient | null => {
    const { timetreeEmail: email, timetreePassword: pw } = s.calendar;
    if (!email || !pw) return null;
    const key = `${email}\n${pw}`;
    if (!timetree || timetree.key !== key) timetree = { key, client: new TimeTreeClient(email, pw) };
    return timetree.client;
  };

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));

  const api = express.Router();
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // ------------------------------------------------------------------ 基本情報
  api.get('/health', (req, res) => {
    const port = Number(req.socket.localPort ?? 0);
    res.json({ ok: true, version: opts.version ?? 'dev', time: Date.now(), dataDir, urls: lanUrls(port) });
  });

  // ------------------------------------------------------------------ 設定（PC ローカル保存）
  api.get('/settings', async (_req, res) => {
    res.json(toPublic(await settingsStore.read()));
  });

  api.put('/settings', async (req, res) => {
    const incoming = req.body as Partial<PublicSettings>;
    if (!incoming || typeof incoming !== 'object') throw new HttpError(400, '設定の形式が正しくありません');
    const saved = await settingsStore.update((current) => {
      const next = normalizeSettings(incoming);
      const pwSet = (incoming.calendar as PublicSettings['calendar'] | undefined)?.timetreePasswordSet;
      if (!next.calendar.timetreePassword) {
        next.calendar.timetreePassword = pwSet === false ? '' : current.calendar.timetreePassword;
      }
      delete (next.calendar as Partial<PublicSettings['calendar']>).timetreePasswordSet;
      // ロック状態は専用API（/api/lock）でのみ変更する（設定画面の保存で上書きされないように）
      next.lock = current.lock;
      return next;
    });
    cache.clear();
    res.json(toPublic(saved));
  });

  // ------------------------------------------------------------------ レイアウト
  api.get('/layout', async (_req, res) => {
    res.json(await layoutStore.read());
  });

  api.put('/layout', async (req, res) => {
    const saved = await layoutStore.write({ ...normalizeLayout(req.body), updatedAt: Date.now() });
    res.json(saved);
  });

  // ------------------------------------------------------------------ 共有ボード
  const text = (v: unknown, max: number) => {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s) throw new HttpError(400, '内容を入力してください');
    return s.slice(0, max);
  };
  const listId = (req: Request) => {
    const id = String(req.params.listId);
    if (!/^[\w-]{1,40}$/.test(id)) throw new HttpError(400, 'リストIDが不正です');
    return id;
  };
  const touch = (b: BoardsState) => ({ ...b, updatedAt: Date.now() });

  api.get('/boards', async (_req, res) => {
    res.json(await boardsStore.read());
  });

  api.post('/memos', async (req, res) => {
    const b = await boardsStore.update((cur) => {
      cur.memos.unshift({
        id: newId('m'),
        text: text(req.body?.text, 1000),
        color: typeof req.body?.color === 'string' ? req.body.color : '#ffd166',
        author: typeof req.body?.author === 'string' ? req.body.author.slice(0, 20) : undefined,
        createdAt: Date.now(),
      });
      return touch(cur);
    });
    res.json(b);
  });

  api.patch('/memos/:id', async (req, res) => {
    const b = await boardsStore.update((cur) => {
      const m = cur.memos.find((x) => x.id === req.params.id);
      if (m) {
        if (typeof req.body?.text === 'string') m.text = text(req.body.text, 1000);
        if (typeof req.body?.color === 'string') m.color = req.body.color;
      }
      return touch(cur);
    });
    res.json(b);
  });

  api.delete('/memos/:id', async (req, res) => {
    const b = await boardsStore.update((cur) => touch({ ...cur, memos: cur.memos.filter((m) => m.id !== req.params.id) }));
    res.json(b);
  });

  api.post('/lists/:listId/items', async (req, res) => {
    const id = listId(req);
    const b = await boardsStore.update((cur) => {
      // 日付ごとのチェックリスト（コドモンタイル用）は7日より古いものを削除する
      const daily = id.match(/^(.+)-(\d{8})$/);
      if (daily) {
        const limit = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10).replace(/-/g, '');
        for (const key of Object.keys(cur.lists)) {
          const m = key.match(/^(.+)-(\d{8})$/);
          if (m && m[1] === daily[1] && m[2] < limit) delete cur.lists[key];
        }
      }
      const items = (cur.lists[id] ??= []);
      const item: ListItem = { id: newId('i'), text: text(req.body?.text, 500), done: false, createdAt: Date.now() };
      if (req.body?.important === true) item.important = true;
      items.push(item);
      return touch(cur);
    });
    res.json(b);
  });

  api.patch('/lists/:listId/items/:itemId', async (req, res) => {
    const id = listId(req);
    const b = await boardsStore.update((cur) => {
      const item = cur.lists[id]?.find((x) => x.id === req.params.itemId);
      if (item) {
        if (typeof req.body?.done === 'boolean') {
          item.done = req.body.done;
          item.doneAt = req.body.done ? Date.now() : undefined;
        }
        if (typeof req.body?.text === 'string') item.text = text(req.body.text, 500);
        if (typeof req.body?.important === 'boolean') item.important = req.body.important || undefined;
      }
      return touch(cur);
    });
    res.json(b);
  });

  api.delete('/lists/:listId/items/:itemId', async (req, res) => {
    const id = listId(req);
    const b = await boardsStore.update((cur) => {
      if (cur.lists[id]) cur.lists[id] = cur.lists[id].filter((x) => x.id !== req.params.itemId);
      return touch(cur);
    });
    res.json(b);
  });

  api.post('/lists/:listId/clear-done', async (req, res) => {
    const id = listId(req);
    const b = await boardsStore.update((cur) => {
      if (cur.lists[id]) cur.lists[id] = cur.lists[id].filter((x) => !x.done);
      return touch(cur);
    });
    res.json(b);
  });

  // ------------------------------------------------------------------ 天気（Open-Meteo / 無料・キー不要）
  const coord = (v: unknown, fallback: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
  };

  api.get('/weather', async (req, res) => {
    const s = await settingsStore.read();
    const lat = coord(req.query.lat, s.location.lat, -90, 90);
    const lon = coord(req.query.lon, s.location.lon, -180, 180);
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation' +
      '&hourly=temperature_2m,precipitation_probability,weather_code,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max' +
      '&timezone=Asia%2FTokyo&forecast_days=7&wind_speed_unit=ms';
    const data = await cache.get(`weather:${lat.toFixed(3)},${lon.toFixed(3)}`, 10 * MIN, () => fetchJson(url));
    res.json(data);
  });

  api.get('/geocode', async (req, res) => {
    const q = String(req.query.q ?? '').trim().slice(0, 60);
    if (!q) return res.json({ results: [] });
    const data = await cache.get(`geo:${q}`, 24 * 60 * MIN, () =>
      fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=ja&format=json`),
    );
    res.json(data);
  });

  // ------------------------------------------------------------------ ニュース（RSS）
  const loadFeed = (name: string, url: string): Promise<FeedItem[]> =>
    cache.get(`feed:${url}`, 10 * MIN, async () => parseFeed(await fetchText(url), name));

  async function collect(tasks: { name: string; load: () => Promise<FeedItem[]> }[], limit: number): Promise<FeedResponse> {
    const results = await Promise.allSettled(tasks.map((t) => t.load()));
    const errors: string[] = [];
    const lists: FeedItem[][] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') lists.push(r.value);
      else errors.push(`${tasks[i].name}: ${(r.reason as Error).message}`);
    });
    return { items: mergeFeedItems(lists, limit), errors, fetchedAt: Date.now() };
  }

  api.get('/feeds/tigers', async (_req, res) => {
    const s = (await settingsStore.read()).tigers;
    const tasks: { name: string; load: () => Promise<FeedItem[]> }[] = [];
    if (s.officialSite) {
      tasks.push({
        name: '阪神タイガース公式',
        load: () => cache.get('tigers:official', 15 * MIN, async () => parseTigersOfficial(await fetchText(TIGERS_OFFICIAL_NEWS_URL))),
      });
    }
    for (const f of s.feeds.filter((x) => x.enabled && isHttpUrl(x.url))) tasks.push({ name: f.name, load: () => loadFeed(f.name, f.url) });
    const base = s.rsshubBase.replace(/\/+$/, '');
    if (base && isHttpUrl(base)) {
      if (s.xAccount) tasks.push({ name: `X @${s.xAccount}`, load: () => loadFeed(`X @${s.xAccount}`, `${base}/twitter/user/${encodeURIComponent(s.xAccount)}`) });
      if (s.instagramAccount)
        tasks.push({ name: 'Instagram', load: () => loadFeed('Instagram', `${base}/instagram/user/${encodeURIComponent(s.instagramAccount)}`) });
    }
    res.json(await collect(tasks, 60));
  });

  api.get('/feeds/news', async (req, res) => {
    const feeds = (await settingsStore.read()).news.feeds.filter((f) => isHttpUrl(f.url));
    const wanted = String(req.query.feed ?? '');
    const targets = wanted === 'enabled' || !wanted ? feeds.filter((f) => f.enabled) : feeds.filter((f) => f.id === wanted);
    const list = targets.length ? targets : feeds.slice(0, 1);
    res.json(await collect(list.map((f) => ({ name: f.name, load: () => loadFeed(f.name, f.url) })), 60));
  });

  // ------------------------------------------------------------------ 気象庁（警報・注意報 / 雨雲レーダー）
  api.get('/jma/warnings', async (req, res) => {
    const loc = (await settingsStore.read()).location;
    const office = /^\d{6}$/.test(String(req.query.office)) ? String(req.query.office) : loc.jmaOffice;
    const area = /^\d{6,7}$/.test(String(req.query.area)) ? String(req.query.area) : loc.jmaArea;
    const data = await cache.get(`jma:warn:${office}`, 5 * MIN, () => fetchJson(`https://www.jma.go.jp/bosai/warning/data/r8/${office}.json`));
    const parsed = parseWarnings(data, area);
    const body: WarningResponse = { areaName: loc.jmaArea === area ? loc.jmaAreaName : area, ...parsed, fetchedAt: Date.now() };
    res.json(body);
  });

  api.get('/jma/areas', async (_req, res) => {
    const list = await cache.get<AreaList>('jma:areas', 24 * 60 * MIN, async () =>
      buildAreaList(await fetchJson('https://www.jma.go.jp/bosai/common/const/area.json')),
    );
    res.json(list);
  });

  api.get('/jma/radar', async (_req, res) => {
    type Frame = { basetime: string; validtime: string; elements: string[] };
    const [past, future] = await Promise.all([
      cache.get<Frame[]>('jma:n1', MIN, () => fetchJson('https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json')),
      cache.get<Frame[]>('jma:n2', MIN, () => fetchJson('https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N2.json')).catch(() => [] as Frame[]),
    ]);
    const pick = (list: Frame[]) => list.filter((f) => f.elements?.includes('hrpns')).map(({ basetime, validtime }) => ({ basetime, validtime }));
    const pastFrames = pick(past).sort((a, b) => a.validtime.localeCompare(b.validtime)).slice(-12);
    const futureFrames = pick(future)
      .filter((f) => f.validtime > (pastFrames.at(-1)?.validtime ?? ''))
      .sort((a, b) => a.validtime.localeCompare(b.validtime))
      .slice(0, 6);
    res.json({ past: pastFrames, future: futureFrames });
  });

  // ------------------------------------------------------------------ チラシ
  api.get('/flyers', async (_req, res) => {
    const stores = (await settingsStore.read()).flyers.stores.filter((st) => isHttpUrl(st.url));
    const results = await Promise.all(
      stores.map(async (st) => {
        try {
          const page = await cache.get(`flyer:${st.url}`, 180 * MIN, async () => extractFlyers(await fetchText(st.url), st.url));
          return { id: st.id, name: st.name || page.name, url: st.url, flyers: page.flyers };
        } catch (err) {
          return { id: st.id, name: st.name || st.url, url: st.url, flyers: [], error: (err as Error).message };
        }
      }),
    );
    const body: FlyerResponse = { stores: results, fetchedAt: Date.now() };
    res.json(body);
  });

  // ------------------------------------------------------------------ 予定（TimeTree / iCal）
  api.get('/calendar/events', async (req, res) => {
    const s = await settingsStore.read();
    const days = Math.min(92, Math.max(1, Number(req.query.days) || s.calendar.days || 31));
    const from = startOfTodayJst();
    const to = from + days * 86400_000 - 1;
    const body = await cache.get<CalendarResponse>(`cal:${days}:${from}`, 15 * MIN, async () => {
      const errors: string[] = [];
      const events: CalendarEvent[] = [];
      const tt = getTimeTree(s);
      if (tt) {
        try {
          const cals = await cache.get<TimeTreeCalendarInfo[]>('tt:calendars', 60 * MIN, () => tt.calendars());
          const wanted = s.calendar.timetreeCalendarIds;
          const targets = wanted.length ? cals.filter((c) => wanted.includes(c.id)) : cals;
          for (const c of targets) {
            const raw = await tt.rawEvents(c.id);
            events.push(...expandTimeTreeEvents(raw, c.name, from, to, c.color));
          }
        } catch (err) {
          errors.push((err as Error).message);
        }
      }
      for (const raw of s.calendar.icsUrls) {
        const url = raw.replace(/^webcal:/i, 'https:');
        if (!isHttpUrl(url)) continue;
        try {
          const name = new URL(url).host.includes('google') ? 'Google' : 'カレンダー';
          events.push(...parseIcs(await fetchText(url), name, from, to));
        } catch (err) {
          errors.push(`iCal: ${(err as Error).message}`);
        }
      }
      events.sort((a, b) => a.start - b.start || Number(b.allDay) - Number(a.allDay));
      return { events, errors, fetchedAt: Date.now() };
    });
    res.json(body);
  });

  api.get('/calendar/timetree-calendars', async (_req, res) => {
    const tt = getTimeTree(await settingsStore.read());
    if (!tt) throw new HttpError(400, 'TimeTree のメールアドレスとパスワードを保存してください');
    res.json({ calendars: await tt.calendars() });
  });

  // ------------------------------------------------------------------ フォトフレーム
  const photoDir = async () => {
    const dir = (await settingsStore.read()).photos.dir.trim() || path.join(dataDir, 'photos');
    await fs.mkdir(dir, { recursive: true }).catch(() => undefined);
    return dir;
  };

  api.get('/photos', async (_req, res) => {
    const dir = await photoDir();
    let files: string[] = [];
    try {
      files = (await fs.readdir(dir)).filter((f) => IMAGE_EXT.test(f)).sort((a, b) => a.localeCompare(b, 'ja'));
    } catch {
      files = [];
    }
    res.json({ dir, files: files.map((name) => ({ name, url: `/api/photos/file/${encodeURIComponent(name)}` })) });
  });

  api.get('/photos/file/:name', async (req, res) => {
    const name = path.basename(String(req.params.name));
    if (!IMAGE_EXT.test(name)) throw new HttpError(404, 'not found');
    const dir = await photoDir();
    const file = path.join(dir, name);
    if (!file.startsWith(path.resolve(dir)) || !existsSync(file)) throw new HttpError(404, 'not found');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(file);
  });

  // ------------------------------------------------------------------ リモコン（スマホから表示端末を操作）
  const COMMANDS = new Set(['goto', 'next', 'prev', 'reload', 'dim', 'undim', 'identify', 'sync']);

  api.get('/remote/stream', (req, res) => {
    const id = req.query.id;
    if (!RemoteHub.validId(id)) throw new HttpError(400, '端末IDが不正です');
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    const detach = remote.attach(id, res);
    req.on('close', detach);
  });

  api.post('/remote/heartbeat', (req, res) => {
    const body = req.body as Record<string, unknown>;
    if (!RemoteHub.validId(body?.id)) throw new HttpError(400, '端末IDが不正です');
    res.json(remote.heartbeat({ ...body, id: body.id }));
  });

  // メイン画面のロック（リモコンから切り替え）。変更したら全端末にすぐ反映させる
  api.put('/lock', async (req, res) => {
    const enabled = req.body?.enabled === true;
    const saved = await settingsStore.update((cur) => ({ ...cur, lock: { enabled } }));
    remote.send('all', { type: 'sync' });
    res.json({ enabled: saved.lock.enabled });
  });

  api.get('/remote/displays', (_req, res) => {
    res.json({ displays: remote.list() });
  });

  api.post('/remote/command', (req, res) => {
    const target = String(req.body?.target ?? 'all');
    const command = req.body?.command as RemoteCommand | undefined;
    if (!command || !COMMANDS.has(command.type)) throw new HttpError(400, '不明な命令です');
    if (target !== 'all' && !RemoteHub.validId(target)) throw new HttpError(400, '端末IDが不正です');
    if (command.type === 'goto' && !(Number.isInteger(command.page) && command.page >= 0)) throw new HttpError(400, 'ページ番号が不正です');
    res.json({ delivered: remote.send(target, command) });
  });

  // ------------------------------------------------------------------ エクスポート / インポート
  api.get('/export', async (req, res) => {
    const includeSecrets = req.query.secrets === '1';
    const settings = structuredClone(await settingsStore.read());
    if (!includeSecrets) {
      settings.wifi.password = '';
      settings.calendar.timetreePassword = '';
    }
    const bundle: ExportBundle = {
      app: 'home-information',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      includesSecrets: includeSecrets,
      settings,
      layout: await layoutStore.read(),
      boards: await boardsStore.read(),
    };
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.setHeader('Content-Disposition', `attachment; filename="home-information-${stamp}.json"`);
    res.json(bundle);
  });

  api.post('/import', async (req, res) => {
    const bundle = req.body?.bundle as Partial<ExportBundle> | undefined;
    const sections: string[] = Array.isArray(req.body?.sections) ? req.body.sections : ['settings', 'layout', 'boards'];
    if (!bundle || bundle.app !== 'home-information' || bundle.formatVersion !== 1) {
      throw new HttpError(400, 'Home Information のエクスポートファイルではありません');
    }
    const imported: string[] = [];
    if (sections.includes('settings') && bundle.settings) {
      await settingsStore.update((cur) => {
        const next = normalizeSettings(bundle.settings);
        // 秘匿情報を含まないファイルなら、現在の値を引き継ぐ
        if (!next.wifi.password) next.wifi.password = cur.wifi.password;
        if (!next.calendar.timetreePassword) next.calendar.timetreePassword = cur.calendar.timetreePassword;
        return next;
      });
      imported.push('settings');
    }
    if (sections.includes('layout') && bundle.layout) {
      await layoutStore.write({ ...normalizeLayout(bundle.layout), updatedAt: Date.now() });
      imported.push('layout');
    }
    if (sections.includes('boards') && bundle.boards) {
      await boardsStore.write({ ...normalizeBoards(bundle.boards), updatedAt: Date.now() });
      imported.push('boards');
    }
    cache.clear();
    res.json({ ok: true, imported });
  });

  api.use((_req, _res, next) => next(new HttpError(404, 'API が見つかりません')));
  app.use('/api', api);

  // ------------------------------------------------------------------ フロントエンド配信
  if (opts.webDir && existsSync(opts.webDir)) {
    const webDir = opts.webDir;
    app.use(
      express.static(webDir, {
        setHeaders: (res, file) => {
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(webDir, 'index.html'));
    });
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const status = err instanceof HttpError ? err.status : (err as { status?: number }).status ?? 500;
    if (status >= 500) console.error('[api]', err);
    res.status(status).json({ error: err.message || 'サーバーエラー' });
  });

  return { app, stores: { settings: settingsStore, layout: layoutStore, boards: boardsStore }, cache };
}
