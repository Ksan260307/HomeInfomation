// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { KIDS_QUIZ } from '../data/kidsQuiz';
import { TRIVIA } from '../data/trivia';
import { TileSizeContext, makeSizeInfo } from '../components/tileKit';
import { TILE_DEFINITIONS } from './registry';

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
  '/api/flyers': { stores: [{ id: 's', name: 'スーパー', url: 'https://tokubai.co.jp/x/1', flyers: [{ thumb: 'a.jpg', full: 'b.jpg', link: 'https://tokubai.co.jp' }] }], fetchedAt: now },
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

describe('quiz data', () => {
  it('has 100 valid trivia questions', () => {
    expect(TRIVIA).toHaveLength(100);
    expect(new Set(TRIVIA.map((q) => q.id)).size).toBe(100);
    for (const q of TRIVIA) {
      expect(q.choices.length).toBeGreaterThanOrEqual(3);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.choices.length);
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.explain.length).toBeGreaterThan(10);
    }
  });

  it('has 100 valid kids questions', () => {
    expect(KIDS_QUIZ).toHaveLength(100);
    expect(new Set(KIDS_QUIZ.map((q) => q.id)).size).toBe(100);
    for (const q of KIDS_QUIZ) {
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      expect(q.answer).toBeLessThan(q.choices.length);
      expect(new Set(q.choices).size).toBe(q.choices.length);
    }
  });
});
