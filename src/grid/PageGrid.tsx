import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Page, TileInstance } from '../../shared/types';
import { clamp } from '../lib/utils';
import { useApp } from '../state/store';
import { limitsOf } from '../tiles/registry';
import { canPlace, clampSize, type Rect } from './layout';
import { TileFrame, type DragMode } from './TileFrame';

interface Props {
  page: Page;
  pageIndex: number;
  cols: number;
  rows: number;
  onEdgeHold(tileId: string, fromPage: number, dir: -1 | 1, at: { x: number; y: number }): void;
  onOptions(tile: TileInstance): void;
  onDelete(tile: TileInstance): void;
}

interface DragState {
  id: string;
  type: string;
  mode: DragMode;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  origin: Rect;
  target: Rect;
  valid: boolean;
}

const EDGE = 44;

export function PageGrid({ page, pageIndex, cols, rows, onEdgeHold, onOptions, onDelete }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const editMode = useApp((s) => s.editMode);
  const setEditMode = useApp((s) => s.setEditMode);
  const updateProfile = useApp((s) => s.updateProfile);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const press = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // セル寸法（画面サイズに合わせて自動計算）
  const gap = clamp(Math.round(Math.min(box.w, box.h) * 0.02), 8, 16);
  const cellW = Math.max(1, (box.w - gap * (cols - 1)) / cols);
  const cellH = Math.max(1, (box.h - gap * (rows - 1)) / rows);
  const toPx = useCallback(
    (r: Rect) => ({
      left: r.x * (cellW + gap),
      top: r.y * (cellH + gap),
      width: r.w * cellW + (r.w - 1) * gap,
      height: r.h * cellH + (r.h - 1) * gap,
    }),
    [cellW, cellH, gap],
  );

  const metrics = useRef({ cellW, cellH, gap, cols, rows, tiles: page.tiles });
  metrics.current = { cellW, cellH, gap, cols, rows, tiles: page.tiles };

  const onDragStart = useCallback((e: ReactPointerEvent, tile: TileInstance, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    const origin = { x: tile.x, y: tile.y, w: tile.w, h: tile.h };
    const st: DragState = { id: tile.id, type: tile.type, mode, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, origin, target: origin, valid: true };
    dragRef.current = st;
    setDrag(st);
  }, []);

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    let edgeTimer: number | undefined;
    let edgeDir = 0;

    const onMove = (e: PointerEvent) => {
      const st = dragRef.current;
      if (!st) return;
      e.preventDefault();
      const m = metrics.current;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      const stepX = m.cellW + m.gap;
      const stepY = m.cellH + m.gap;
      let target: Rect;
      if (st.mode === 'move') {
        target = {
          ...st.origin,
          x: clamp(st.origin.x + Math.round(dx / stepX), 0, m.cols - st.origin.w),
          y: clamp(st.origin.y + Math.round(dy / stepY), 0, m.rows - st.origin.h),
        };
        // 画面の端で止めると隣のページへ移動
        const dir = e.clientX < EDGE ? -1 : e.clientX > window.innerWidth - EDGE ? 1 : 0;
        if (dir !== edgeDir) {
          window.clearTimeout(edgeTimer);
          edgeDir = dir;
          if (dir !== 0) {
            edgeTimer = window.setTimeout(() => {
              const cur = dragRef.current;
              if (!cur) return;
              dragRef.current = null;
              setDrag(null);
              onEdgeHold(cur.id, pageIndex, dir as -1 | 1, { x: cur.target.x, y: cur.target.y });
            }, 650);
          }
        }
      } else {
        const size = clampSize(
          { w: st.origin.w + Math.round(dx / stepX), h: st.origin.h + Math.round(dy / stepY) },
          limitsOf(st.type),
          m.cols - st.origin.x,
          m.rows - st.origin.y,
        );
        target = { ...st.origin, ...size };
      }
      const valid = canPlace(target, m.tiles, m.cols, m.rows, st.id);
      const next = { ...st, dx, dy, target, valid };
      dragRef.current = next;
      setDrag(next);
    };

    const onUp = () => {
      window.clearTimeout(edgeTimer);
      const st = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!st || !st.valid) return;
      const { origin: o, target: t } = st;
      if (o.x === t.x && o.y === t.y && o.w === t.w && o.h === t.h) return;
      updateProfile((p) => {
        const tile = p.pages[pageIndex]?.tiles.find((x) => x.id === st.id);
        if (tile) Object.assign(tile, t);
        return p;
      });
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.clearTimeout(edgeTimer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, pageIndex, onEdgeHold, updateProfile]);

  const onLongPress = useCallback(() => setEditMode(true), [setEditMode]);

  // 空いている場所の長押しでも編集モードへ
  const onGridPointerDown = (e: ReactPointerEvent) => {
    if (editMode || e.target !== e.currentTarget) return;
    window.clearTimeout(press.current);
    press.current = window.setTimeout(() => setEditMode(true), 600);
  };
  const cancelGridPress = () => window.clearTimeout(press.current);

  return (
    <div
      ref={ref}
      className={`grid ${editMode ? 'is-editing' : ''} ${dragging ? 'is-dragging' : ''}`}
      onPointerDown={onGridPointerDown}
      onPointerUp={cancelGridPress}
      onPointerCancel={cancelGridPress}
      onPointerMove={cancelGridPress}
    >
      {editMode &&
        box.w > 0 &&
        Array.from({ length: cols * rows }, (_, i) => {
          const r = toPx({ x: i % cols, y: Math.floor(i / cols), w: 1, h: 1 });
          return <div key={i} className="grid-cell" style={{ transform: `translate(${r.left}px, ${r.top}px)`, width: r.width, height: r.height }} />;
        })}

      {drag &&
        (() => {
          const r = toPx(drag.target);
          return (
            <div
              className={`drop-hint ${drag.valid ? '' : 'is-invalid'}`}
              style={{ transform: `translate(${r.left}px, ${r.top}px)`, width: r.width, height: r.height }}
            />
          );
        })()}

      {box.w > 0 &&
        page.tiles.map((tile) => {
          const isDragged = drag?.id === tile.id;
          let r = toPx(tile);
          if (isDragged && drag) {
            if (drag.mode === 'move') r = { ...r, left: r.left + drag.dx, top: r.top + drag.dy };
            else r = { ...r, width: Math.max(cellW, r.width + drag.dx), height: Math.max(cellH, r.height + drag.dy) };
          }
          return (
            <TileFrame
              key={tile.id}
              tile={tile}
              left={r.left}
              top={r.top}
              width={r.width}
              height={r.height}
              editMode={editMode}
              dragging={isDragged}
              onDragStart={onDragStart}
              onLongPress={onLongPress}
              onOptions={onOptions}
              onDelete={onDelete}
            />
          );
        })}
    </div>
  );
}
