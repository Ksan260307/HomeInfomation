import { describe, expect, it } from 'vitest';
import type { LayoutProfile } from '../../shared/types';
import { canPlace, clampSize, findFreeSpot, placeTile, reflowProfile, repairProfile } from './layout';

const limits = () => ({ minSize: { w: 1, h: 1 }, maxSize: { w: 8, h: 6 } });
const tile = (id: string, x: number, y: number, w: number, h: number) => ({ id, type: 'clock', x, y, w, h });

describe('grid layout', () => {
  it('detects collisions and bounds', () => {
    const tiles = [tile('a', 0, 0, 2, 2)];
    expect(canPlace({ x: 1, y: 1, w: 2, h: 2 }, tiles, 8, 6)).toBe(false);
    expect(canPlace({ x: 2, y: 0, w: 2, h: 2 }, tiles, 8, 6)).toBe(true);
    expect(canPlace({ x: 7, y: 0, w: 2, h: 1 }, tiles, 8, 6)).toBe(false);
    // 自分自身は無視できる
    expect(canPlace({ x: 1, y: 1, w: 2, h: 2 }, tiles, 8, 6, 'a')).toBe(true);
  });

  it('finds the first free spot', () => {
    const tiles = [tile('a', 0, 0, 4, 2)];
    expect(findFreeSpot({ w: 4, h: 2 }, tiles, 8, 6)).toEqual({ x: 4, y: 0 });
    expect(findFreeSpot({ w: 9, h: 1 }, tiles, 8, 6)).toBeNull();
  });

  it('clamps size to limits and grid', () => {
    expect(clampSize({ w: 10, h: 0 }, { minSize: { w: 2, h: 2 } }, 8, 6)).toEqual({ w: 8, h: 2 });
  });

  it('adds a new page when the current pages are full', () => {
    const profile: LayoutProfile = { cols: 2, rows: 2, pages: [{ id: 'p', tiles: [tile('a', 0, 0, 2, 2)] }] };
    const res = placeTile(profile, 0, { id: 'b', type: 'clock', w: 1, h: 1 }, limits());
    expect(res.pageIndex).toBe(1);
    expect(res.profile.pages).toHaveLength(2);
    expect(res.profile.pages[1].tiles[0]).toMatchObject({ id: 'b', x: 0, y: 0 });
  });

  it('reflows a landscape layout into a narrower grid without overlaps', () => {
    const src: LayoutProfile = {
      cols: 8,
      rows: 6,
      pages: [{ id: 'p', tiles: [tile('a', 0, 0, 4, 3), tile('b', 4, 0, 4, 3), tile('c', 0, 3, 8, 3)] }],
    };
    const out = reflowProfile(src, 4, 6, limits);
    const all = out.pages.flatMap((p) => p.tiles);
    expect(all).toHaveLength(3);
    for (const p of out.pages) {
      for (const t of p.tiles) {
        expect(t.x + t.w).toBeLessThanOrEqual(4);
        expect(t.y + t.h).toBeLessThanOrEqual(6);
        expect(canPlace(t, p.tiles, 4, 6, t.id)).toBe(true);
      }
    }
  });

  it('repairs overlapping tiles', () => {
    const profile: LayoutProfile = { cols: 4, rows: 4, pages: [{ id: 'p', tiles: [tile('a', 0, 0, 2, 2), tile('b', 1, 1, 2, 2)] }] };
    const fixed = repairProfile(profile, limits);
    const [a, b] = fixed.pages[0].tiles;
    expect(canPlace(b, [a], 4, 4)).toBe(true);
  });
});
