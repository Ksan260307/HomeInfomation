// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FUN_FACTS } from '../data/funFacts';
import { KIDS_QUIZ } from '../data/kidsQuiz';
import { TRIVIA } from '../data/trivia';
import { TileSizeContext, makeSizeInfo } from '../components/tileKit';
import { TILE_DEFINITIONS } from './registry';
import { flattenFlyers, groupFlyers } from './FlyerTile';
import { isSafeShortcutUrl } from './ShortcutTile';
import { cleanStoreName, shortStoreNames } from '../../shared/storeName';
import type { FlyerResponse } from '../../shared/types';

/** 各タイルを「いろいろなサイズ」で描画して、例外が出ない（表示が崩れて落ちない）ことを確認する */

const now = Date.now();
const FIXTURES: Record<string, unknown> = {
  '/api/weather': {
    current: { time: '2026-11-22T22:00', temperature_2m: 8, apparent_temperature: 6, relative_humidity_2m: 65, weather_code: 1, wind_speed_10m: 2, is_day: 0 },
    hourly: {
      time: Array.from({ length: 48 }, (_, i) => `2026-11-${22 + Math.floor((22 + i) / 24)}T${String((22 + i) % 24).padStart(2, '0')}:00`),
      temperature_2m: Array(48).fill(7),
      precipitation_probability: Array(48).fill(10),
      weather_code: Array(48).fill(3),
      is_day: Array(48).fill(1),
    },
    daily: {
      time: ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28'],
      weather_code: [1, 2, 3, 61, 0, 0, 1],
      temperature_2m_max: [11, 12, 13, 14, 15, 16, 17],
      temperature_2m_min: [5, 4, 3, 2, 1, 0, -1],
      precipitation_probability_max: [0, 10, 20, 80, 0, 0, 0],
      sunrise: [],
      sunset: [],
      uv_index_max: [],
    },
  },
  '/api/feeds': {
    items: Array.from({ length: 8 }, (_, i) => ({ id: String(i), title: `とても長いニュースの見出し ${i} `.repeat(3), link: 'https://example.com', source: 'テスト', publishedAt: now - i * 60_000 })),
    errors: [],
    fetchedAt: now,
  },
  '/api/jma/warnings': { areaName: '大阪市', reportDatetime: '2026-11-21T04:17:00+09:00', headline: '乾燥', items: [{ code: '21', name: '乾燥注意報', level: 20, status: '発表' }], fetchedAt: now },
  '/api/flyers': {
    stores: [
      { id: 's', name: 'スーパー', url: 'https://tokubai.co.jp/x/1', flyers: [{ thumb: 'a.jpg', full: 'b.jpg', link: 'https://tokubai.co.jp' }] },
      {
        id: 'd',
        name: 'ドラッグストア',
        url: 'https://tokubai.co.jp/x/2',
        flyers: [
          { thumb: 'c.jpg', full: 'c2.jpg', link: 'https://tokubai.co.jp' },
          { thumb: 'd.jpg', full: 'd2.jpg', link: 'https://tokubai.co.jp' },
        ],
      },
    ],
    fetchedAt: now,
  },
  '/api/calendar/events': { events: [{ id: 'e', title: '保育園の参観日', start: now + 3600_000, end: now + 7200_000, allDay: false, calendar: 'TimeTree' }], errors: [], fetchedAt: now },
  '/api/jma/radar': { past: [{ basetime: '20261122120000', validtime: '20261122120000' }], future: [{ basetime: '20261122120000', validtime: '20261122123000' }] },
  '/api/photos': { dir: 'C:/photos', files: [{ name: 'a.jpg', url: '/api/photos/file/a.jpg' }] },
};

beforeAll(() => {
  // jsdom に無い API を最小限用意する（雨雲レーダーの地図が使用）
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const key = Object.keys(FIXTURES).find((k) => String(url).startsWith(k));
      return new Response(JSON.stringify(key ? FIXTURES[key] : {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});

afterEach(cleanup);

const SIZES: [number, number, number, number][] = [
  [90, 90, 1, 1],
  [180, 150, 2, 1],
  [300, 300, 2, 2],
  [600, 250, 4, 2],
  [420, 700, 3, 5],
  [900, 700, 6, 5],
];

describe('tiles render at every size', () => {
  for (const def of TILE_DEFINITIONS) {
    it(def.type, async () => {
      for (const [w, h, cols, rows] of SIZES) {
        const tile = { id: `${def.type}-test`, type: def.type, x: 0, y: 0, w: cols, h: rows };
        const Comp = def.component;
        const { unmount, container } = render(
          <TileSizeContext.Provider value={makeSizeInfo(w, h, cols, rows)}>
            <Comp tile={tile} props={{ ...(def.defaultProps ?? {}) }} />
          </TileSizeContext.Provider>,
        );
        await act(async () => {
          await new Promise((r) => setTimeout(r, 0));
        });
        expect(container).toBeTruthy();
        unmount();
      }
    });
  }
});

describe('shortcut urls', () => {
  it('allows https and app schemes but blocks dangerous ones', () => {
    expect(isSafeShortcutUrl('https://www.nintendo.com/jp/nintendo-music/index.html')).toBe(true);
    expect(isSafeShortcutUrl('youtube://')).toBe(true);
    expect(isSafeShortcutUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeShortcutUrl(' JavaScript:alert(1)')).toBe(false);
    expect(isSafeShortcutUrl('data:text/html,x')).toBe(false);
    expect(isSafeShortcutUrl('example.com')).toBe(false);
  });
});

describe('weather weekly view', () => {
  it('renders 7-day forecast in rows or columns depending on size', async () => {
    const def = TILE_DEFINITIONS.find((d) => d.type === 'weather')!;
    const Comp = def.component;
    for (const [w, h, cols, rows] of SIZES) {
      const { container, unmount } = render(
        <TileSizeContext.Provider value={makeSizeInfo(w, h, cols, rows)}>
          <Comp tile={{ id: 'wx', type: 'weather', x: 0, y: 0, w: cols, h: rows }} props={{ view: 'weekly' }} />
        </TileSizeContext.Provider>,
      );
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      const days = container.querySelectorAll('.wx-wd');
      expect(days.length).toBeGreaterThanOrEqual(2);
      expect(days.length).toBeLessThanOrEqual(7);
      unmount();
    }
  });
});

describe('flyer browsing', () => {
  const data = FIXTURES['/api/flyers'] as FlyerResponse;

  it('groups flyers by store in registration order', () => {
    const all = flattenFlyers(data);
    expect(all.map((f) => `${f.store}${f.nth + 1}/${f.count}`)).toEqual(['スーパー1/1', 'ドラッグストア1/2', 'ドラッグストア2/2']);
    const groups = groupFlyers(all);
    expect(groups.map((g) => [g.store, g.start, g.items.length])).toEqual([
      ['スーパー', 0, 1],
      ['ドラッグストア', 1, 2],
    ]);
    expect(flattenFlyers(data, 'd')).toHaveLength(2);
  });

  it('shortens store names for the store buttons', () => {
    expect(cleanStoreName('ローソン 公園南矢田三丁目店の新商品・クーポン')).toBe('ローソン 公園南矢田三丁目店');
    expect(cleanStoreName('3COINS＋plus セブンパーク天美店の商品・店舗情報')).toBe('3COINS＋plus セブンパーク天美店');
    expect(cleanStoreName('イオン 札幌平岡店のチラシ・特売情報 | トクバイ')).toBe('イオン 札幌平岡店');
    expect(shortStoreNames(['万代 苅田店', 'ロピア ららぽーと堺店の新商品・クーポン'])).toEqual(['万代', 'ロピア']);
    expect(shortStoreNames(['万代 苅田店', '万代 矢田店', 'コープ'])).toEqual(['万代 苅田店', '万代 矢田店', 'コープ']);
  });

  it('narrows to one store with the store buttons and opens a grouped list', async () => {
    const def = TILE_DEFINITIONS.find((d) => d.type === 'flyer')!;
    const Comp = def.component;
    const { container, getByRole, getAllByRole, unmount } = render(
      <TileSizeContext.Provider value={makeSizeInfo(600, 400, 4, 4)}>
        <Comp tile={{ id: 'fl', type: 'flyer', x: 0, y: 0, w: 4, h: 4 }} props={{ ...(def.defaultProps ?? {}) }} />
      </TileSizeContext.Provider>,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const chips = container.querySelectorAll('.flyer-chips .chip-btn');
    expect([...chips].map((c) => c.textContent)).toEqual(['すべて', 'スーパー1', 'ドラッグストア2']);

    fireEvent.click(chips[2]);
    const stores = [...container.querySelectorAll('.flyer-card .flyer-store')].map((e) => e.textContent);
    expect(stores.length).toBeGreaterThan(0);
    expect(stores.every((t) => t?.startsWith('ドラッグストア'))).toBe(true);
    expect(chips[2].getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(getByRole('button', { name: 'チラシを一覧で見る' }));
    const sections = document.querySelectorAll('.flyer-grid-section');
    expect([...sections].map((s) => s.querySelector('.flyer-grid-title')?.firstChild?.textContent)).toEqual(['スーパー', 'ドラッグストア']);
    expect(document.querySelectorAll('.flyer-grid-item')).toHaveLength(3);

    // 一覧から選ぶと、そのチラシを大きく表示する
    fireEvent.click(getAllByRole('button', { name: 'ドラッグストアのチラシ 2枚目を開く' })[0]);
    expect(document.querySelector('.flyer-viewer-title')?.textContent).toContain('2 / 2枚目');
    expect(document.querySelector('.flyer-viewer-scroll img')?.getAttribute('src')).toBe('d2.jpg');
    unmount();
  });
});

describe('quiz data', () => {
  it('has 400 valid trivia questions', () => {
    expect(TRIVIA).toHaveLength(400);
    expect(new Set(TRIVIA.map((q) => q.id)).size).toBe(400);
    expect(new Set(TRIVIA.map((q) => q.q)).size).toBe(400);
    for (const q of TRIVIA) {
      expect(q.choices.length).toBeGreaterThanOrEqual(3);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.choices.length);
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.explain.length).toBeGreaterThan(10);
    }
  });

  it('has 400 valid kids questions', () => {
    expect(KIDS_QUIZ).toHaveLength(400);
    expect(new Set(KIDS_QUIZ.map((q) => q.id)).size).toBe(400);
    for (const q of KIDS_QUIZ) {
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      expect(q.answer).toBeLessThan(q.choices.length);
      expect(new Set(q.choices).size).toBe(q.choices.length);
    }
  });

  it('has 400 fun facts written as statements (not questions)', () => {
    expect(FUN_FACTS).toHaveLength(400);
    expect(new Set(FUN_FACTS.map((f) => f.text)).size).toBe(400);
    for (const f of FUN_FACTS) {
      expect(f.text.length).toBeGreaterThan(15);
      expect(f.text).not.toMatch(/[？?]$/);
    }
  });
});
