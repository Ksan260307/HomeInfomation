import type { LayoutProfile, Page, ProfileId, TileInstance } from '../../shared/types';

/**
 * Android のホーム画面のような「固定グリッド」上のタイル配置ロジック（純粋関数）。
 * ページは画面1枚分（cols × rows）で、スクロールせずにスワイプで次のページへ移動する。
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

export const GRID_PRESETS: Record<ProfileId, { cols: number; rows: number; label: string }> = {
  'tablet-landscape': { cols: 8, rows: 6, label: 'タブレット（横向き）' },
  'tablet-portrait': { cols: 6, rows: 8, label: 'タブレット（縦向き）' },
  phone: { cols: 4, rows: 7, label: 'スマホ' },
};

export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const insideGrid = (r: Rect, cols: number, rows: number) => r.x >= 0 && r.y >= 0 && r.w >= 1 && r.h >= 1 && r.x + r.w <= cols && r.y + r.h <= rows;

export function canPlace(rect: Rect, tiles: readonly Rect[], cols: number, rows: number, ignoreId?: string): boolean {
  if (!insideGrid(rect, cols, rows)) return false;
  return !tiles.some((t) => (t as TileInstance).id !== ignoreId && overlaps(rect, t));
}

/** 左上から順に空いている場所を探す */
export function findFreeSpot(size: Size, tiles: readonly Rect[], cols: number, rows: number, prefer?: { x: number; y: number }): { x: number; y: number } | null {
  if (size.w > cols || size.h > rows) return null;
  const candidates: { x: number; y: number }[] = [];
  for (let y = 0; y + size.h <= rows; y++) {
    for (let x = 0; x + size.w <= cols; x++) {
      if (canPlace({ x, y, ...size }, tiles, cols, rows)) candidates.push({ x, y });
    }
  }
  if (!candidates.length) return null;
  if (!prefer) return candidates[0];
  // 希望位置に最も近い空き
  return candidates.reduce((best, c) =>
    Math.hypot(c.x - prefer.x, c.y - prefer.y) < Math.hypot(best.x - prefer.x, best.y - prefer.y) ? c : best,
  );
}

export interface SizeLimits {
  minSize: Size;
  maxSize?: Size;
}

export function clampSize(size: Size, limits: SizeLimits, cols: number, rows: number): Size {
  const maxW = Math.min(cols, limits.maxSize?.w ?? cols);
  const maxH = Math.min(rows, limits.maxSize?.h ?? rows);
  return {
    w: Math.max(Math.min(limits.minSize.w, maxW), Math.min(size.w, maxW)),
    h: Math.max(Math.min(limits.minSize.h, maxH), Math.min(size.h, maxH)),
  };
}

/** 新しいタイルを置く場所を探す。入らなければサイズを最小まで縮め、それでも無理なら新しいページへ */
export function placeTile(
  profile: LayoutProfile,
  pageIndex: number,
  tile: Omit<TileInstance, 'x' | 'y'>,
  limits: SizeLimits,
): { profile: LayoutProfile; pageIndex: number } {
  const { cols, rows } = profile;
  const sizes = [clampSize(tile, limits, cols, rows), clampSize(limits.minSize, limits, cols, rows)];
  const order = [pageIndex, ...profile.pages.map((_, i) => i).filter((i) => i !== pageIndex)];
  for (const size of sizes) {
    for (const pi of order) {
      const page = profile.pages[pi];
      if (!page) continue;
      const spot = findFreeSpot(size, page.tiles, cols, rows);
      if (spot) {
        const pages = profile.pages.map((p, i) => (i === pi ? { ...p, tiles: [...p.tiles, { ...tile, ...size, ...spot }] } : p));
        return { profile: { ...profile, pages }, pageIndex: pi };
      }
    }
  }
  const size = sizes[0];
  const newPage: Page = { id: newPageId(), tiles: [{ ...tile, ...size, x: 0, y: 0 }] };
  return { profile: { ...profile, pages: [...profile.pages, newPage] }, pageIndex: profile.pages.length };
}

export function newPageId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * 列数が違うグリッドへ移すときの幅。
 * 元の半分以上を占めるタイルは全幅、それ以外は比率で縮めるが、
 * スマホ（4列以下）では細くなりすぎないよう最低でも半幅にする。
 */
export function reflowWidth(w: number, fromCols: number, toCols: number): number {
  const ratio = w / fromCols;
  if (ratio >= 0.5) return toCols;
  const min = toCols <= 4 ? Math.ceil(toCols / 2) : 1;
  return Math.min(toCols, Math.max(min, Math.round(ratio * toCols)));
}

/**
 * 別のグリッドサイズへ詰め直す（縦向き用・スマホ用レイアウトの自動生成、列数変更時など）。
 * ページ内の並び順（上→下、左→右）を保ったまま、入りきらないタイルは次のページへ送る。
 */
export function reflowProfile(source: LayoutProfile, cols: number, rows: number, limitsOf: (type: string) => SizeLimits): LayoutProfile {
  const pages: Page[] = [];
  for (const srcPage of source.pages) {
    const ordered = [...srcPage.tiles].sort((a, b) => a.y - b.y || a.x - b.x);
    let current: Page = { id: srcPage.id, tiles: [] };
    const startIndex = pages.length;
    pages.push(current);
    for (const tile of ordered) {
      const limits = limitsOf(tile.type);
      const size = clampSize({ w: reflowWidth(tile.w, source.cols, cols), h: tile.h }, limits, cols, rows);
      let spot = findFreeSpot(size, current.tiles, cols, rows);
      if (!spot) {
        // 同じ元ページから作られた後続ページを探し、無ければ追加
        let placed = false;
        for (let i = startIndex; i < pages.length; i++) {
          const s = findFreeSpot(size, pages[i].tiles, cols, rows);
          if (s) {
            pages[i].tiles.push({ ...tile, ...size, ...s });
            placed = true;
            break;
          }
        }
        if (placed) continue;
        current = { id: newPageId(), tiles: [] };
        pages.push(current);
        spot = { x: 0, y: 0 };
      }
      current.tiles.push({ ...tile, ...size, ...spot });
    }
  }
  return { cols, rows, pages: pages.length ? pages : [{ id: newPageId(), tiles: [] }] };
}

/** グリッドの外にはみ出した・重なったタイルを直す */
export function repairProfile(profile: LayoutProfile, limitsOf: (type: string) => SizeLimits): LayoutProfile {
  const { cols, rows } = profile;
  let changed = false;
  const overflow: TileInstance[] = [];
  const pages = profile.pages.map((page) => {
    const placed: TileInstance[] = [];
    for (const tile of page.tiles) {
      const size = clampSize(tile, limitsOf(tile.type), cols, rows);
      const rect = { ...tile, ...size };
      if (canPlace(rect, placed, cols, rows)) {
        if (size.w !== tile.w || size.h !== tile.h) changed = true;
        placed.push(rect);
        continue;
      }
      changed = true;
      const spot = findFreeSpot(size, placed, cols, rows, tile);
      if (spot) placed.push({ ...rect, ...spot });
      else overflow.push(rect);
    }
    return { ...page, tiles: placed };
  });
  if (!changed) return profile;
  let result: LayoutProfile = { ...profile, pages };
  for (const t of overflow) result = placeTile(result, result.pages.length - 1, t, limitsOf(t.type)).profile;
  return result;
}

/** ピクセル座標 → グリッド座標 */
export function pixelToCell(px: number, cellSize: number, gap: number): number {
  return Math.round(px / (cellSize + gap));
}
