import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BoardsState, ExportBundle, PublicSettings } from '../shared/types';
import { createApp } from './app';

let server: Server;
let base = '';
let dir = '';

const call = async <T>(method: string, p: string, body?: unknown): Promise<T> => {
  const res = await fetch(`${base}/api${p}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
};

beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'home-info-test-'));
  const { app } = createApp({ dataDir: dir });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('settings API (PC ローカル保存)', () => {
  it('never returns the TimeTree password and keeps it when not re-entered', async () => {
    const s = await call<PublicSettings>('GET', '/settings');
    s.calendar.timetreeEmail = 'me@example.com';
    s.calendar.timetreePassword = 'secret';
    s.wifi.ssid = 'HomeNet';
    const saved = await call<PublicSettings>('PUT', '/settings', s);
    expect(saved.calendar.timetreePassword).toBe('');
    expect(saved.calendar.timetreePasswordSet).toBe(true);

    // パスワード欄が空のまま保存しても消えない
    saved.location.name = '西宮市';
    const again = await call<PublicSettings>('PUT', '/settings', saved);
    expect(again.calendar.timetreePasswordSet).toBe(true);
    expect(again.location.name).toBe('西宮市');

    // 明示的に削除
    again.calendar.timetreePasswordSet = false;
    const cleared = await call<PublicSettings>('PUT', '/settings', again);
    expect(cleared.calendar.timetreePasswordSet).toBe(false);
  });
});

describe('shared boards', () => {
  it('adds, toggles and deletes list items and memos', async () => {
    let b = await call<BoardsState>('POST', '/lists/tasks/items', { text: '牛乳を買う' });
    const id = b.lists.tasks[0].id;
    b = await call<BoardsState>('PATCH', `/lists/tasks/items/${id}`, { done: true });
    expect(b.lists.tasks[0].done).toBe(true);
    b = await call<BoardsState>('POST', '/lists/tasks/clear-done');
    expect(b.lists.tasks).toHaveLength(0);

    b = await call<BoardsState>('POST', '/memos', { text: '19時に帰ります', color: '#ffd166' });
    expect(b.memos[0].text).toBe('19時に帰ります');
    b = await call<BoardsState>('DELETE', `/memos/${b.memos[0].id}`);
    expect(b.memos).toHaveLength(0);
  });

  it('prunes daily check lists older than 7 days', async () => {
    await call('POST', '/lists/codmon-20200101/items', { text: '連絡帳を提出' });
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const b = await call<BoardsState>('POST', `/lists/codmon-${today}/items`, { text: '検温' });
    expect(b.lists['codmon-20200101']).toBeUndefined();
    expect(b.lists[`codmon-${today}`][0].text).toBe('検温');
  });

  it('rejects empty text and bad list ids', async () => {
    await expect(call('POST', '/lists/tasks/items', { text: '  ' })).rejects.toThrow('400');
    await expect(call('POST', '/lists/bad%20id/items', { text: 'x' })).rejects.toThrow('400');
  });
});

describe('export / import', () => {
  it('exports without secrets by default and keeps current secrets on import', async () => {
    const s = await call<PublicSettings>('GET', '/settings');
    s.wifi.password = 'wifi-pass';
    s.calendar.timetreePassword = 'tt-pass';
    await call('PUT', '/settings', s);
    await call('PUT', '/layout', { profiles: { phone: { cols: 4, rows: 7, pages: [{ id: 'p', tiles: [{ id: 't', type: 'clock', x: 0, y: 0, w: 2, h: 2 }] }] } }, updatedAt: 0 });
    await call('POST', '/memos', { text: 'バックアップ' });

    const plain = await call<ExportBundle>('GET', '/export');
    expect(plain.includesSecrets).toBe(false);
    expect(plain.settings.wifi.password).toBe('');
    expect(plain.settings.calendar.timetreePassword).toBe('');
    expect(plain.layout.profiles.phone?.pages[0].tiles[0].type).toBe('clock');
    expect(plain.boards.memos[0].text).toBe('バックアップ');

    const full = await call<ExportBundle>('GET', '/export?secrets=1');
    expect(full.settings.wifi.password).toBe('wifi-pass');

    // 別の内容で上書きインポート（パスワードなしのファイル → 現在のパスワードを維持）
    plain.settings.location.name = 'インポート市';
    plain.boards.memos = [];
    const r = await call<{ imported: string[] }>('POST', '/import', { bundle: plain, sections: ['settings', 'boards'] });
    expect(r.imported).toEqual(['settings', 'boards']);
    const after = await call<PublicSettings>('GET', '/settings');
    expect(after.location.name).toBe('インポート市');
    expect(after.wifi.password).toBe('wifi-pass');
    expect(after.calendar.timetreePasswordSet).toBe(true);
    expect((await call<BoardsState>('GET', '/boards')).memos).toHaveLength(0);
  });

  it('rejects files that are not Home Information exports', async () => {
    await expect(call('POST', '/import', { bundle: { app: 'other' } })).rejects.toThrow('400');
  });
});

describe('remote control', () => {
  it('registers displays and delivers commands over SSE', async () => {
    const id = 'd-test-1234';
    const ctrl = new AbortController();
    const res = await fetch(`${base}/api/remote/stream?id=${id}`, { signal: ctrl.signal });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    await call('POST', '/remote/heartbeat', { id, name: 'リビングのiPad', profile: 'tablet-landscape', page: 1, pageCount: 4, pages: ['🕐⛅', '📝', '🧸', '🛒'] });
    const list = await call<{ displays: { id: string; name: string; connected: boolean; page: number }[] }>('GET', '/remote/displays');
    expect(list.displays.find((d) => d.id === id)).toMatchObject({ name: 'リビングのiPad', connected: true, page: 1 });

    const sent = await call<{ delivered: number }>('POST', '/remote/command', { target: id, command: { type: 'goto', page: 2 } });
    expect(sent.delivered).toBe(1);

    let text = '';
    while (!text.includes('"goto"')) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    expect(text).toContain('{"type":"goto","page":2}');
    ctrl.abort();
  });

  it('rejects unknown commands', async () => {
    await expect(call('POST', '/remote/command', { target: 'all', command: { type: 'format-disk' } })).rejects.toThrow('400');
  });
});

describe('photos', () => {
  it('blocks path traversal', async () => {
    const res = await fetch(`${base}/api/photos/file/..%2F..%2Fsettings.json`);
    expect(res.status).toBe(404);
  });
});
