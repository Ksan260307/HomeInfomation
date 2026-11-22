import type { BoardsState, LayoutProfile, LayoutState, ListItem, MemoNote, Page, TileInstance } from '../../shared/types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

const PROFILE_IDS = ['tablet-landscape', 'tablet-portrait', 'phone'] as const;

function normalizeTile(t: unknown): TileInstance | null {
  if (!isObj(t) || typeof t.id !== 'string' || typeof t.type !== 'string') return null;
  return {
    id: t.id,
    type: t.type,
    x: Math.max(0, num(t.x, 0)),
    y: Math.max(0, num(t.y, 0)),
    w: Math.max(1, num(t.w, 1)),
    h: Math.max(1, num(t.h, 1)),
    props: isObj(t.props) ? t.props : undefined,
  };
}

function normalizeProfile(p: unknown): LayoutProfile | null {
  if (!isObj(p) || !Array.isArray(p.pages)) return null;
  const pages: Page[] = p.pages
    .filter(isObj)
    .map((pg, i) => ({
      id: str(pg.id, `page-${i}`),
      tiles: Array.isArray(pg.tiles) ? pg.tiles.map(normalizeTile).filter((x): x is TileInstance => x !== null) : [],
    }));
  return {
    cols: Math.min(24, Math.max(2, num(p.cols, 8))),
    rows: Math.min(24, Math.max(2, num(p.rows, 6))),
    pages: pages.length ? pages : [{ id: 'page-0', tiles: [] }],
  };
}

export function normalizeLayout(raw: unknown): LayoutState {
  const out: LayoutState = { profiles: {}, updatedAt: 0 };
  if (!isObj(raw)) return out;
  out.updatedAt = num(raw.updatedAt, 0);
  if (isObj(raw.profiles)) {
    for (const id of PROFILE_IDS) {
      const p = normalizeProfile(raw.profiles[id]);
      if (p) out.profiles[id] = p;
    }
  }
  return out;
}

function normalizeMemo(m: unknown): MemoNote | null {
  if (!isObj(m) || typeof m.id !== 'string') return null;
  return { id: m.id, text: str(m.text).slice(0, 1000), color: str(m.color, '#ffd166'), author: str(m.author) || undefined, createdAt: num(m.createdAt, Date.now()) };
}

function normalizeItem(i: unknown): ListItem | null {
  if (!isObj(i) || typeof i.id !== 'string') return null;
  return {
    id: i.id,
    text: str(i.text).slice(0, 500),
    done: i.done === true,
    important: i.important === true || undefined,
    createdAt: num(i.createdAt, Date.now()),
    doneAt: typeof i.doneAt === 'number' ? i.doneAt : undefined,
  };
}

export function normalizeBoards(raw: unknown): BoardsState {
  const out: BoardsState = { memos: [], lists: {}, updatedAt: 0 };
  if (!isObj(raw)) return out;
  out.updatedAt = num(raw.updatedAt, 0);
  if (Array.isArray(raw.memos)) out.memos = raw.memos.map(normalizeMemo).filter((x): x is MemoNote => x !== null);
  if (isObj(raw.lists)) {
    for (const [key, items] of Object.entries(raw.lists)) {
      if (!/^[\w-]{1,40}$/.test(key) || !Array.isArray(items)) continue;
      out.lists[key] = items.map(normalizeItem).filter((x): x is ListItem => x !== null);
    }
  }
  return out;
}
