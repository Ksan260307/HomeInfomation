import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { newId } from '../../shared/defaults';
import type { TileInstance } from '../../shared/types';
import { clampSize, findFreeSpot, newPageId, placeTile } from '../grid/layout';
import { PageGrid } from '../grid/PageGrid';
import { useActiveProfile, useApp } from '../state/store';
import { getTileDef, limitsOf } from '../tiles/registry';
import { Icon } from './icons';
import { TileOptionsDialog } from './TileOptionsDialog';
import { TilePicker } from './TilePicker';

export function HomeScreen({ onOpenSettings }: { onOpenSettings(): void }) {
  const { profile } = useActiveProfile();
  const pageIndex = useApp((s) => s.pageIndex);
  const setPageIndex = useApp((s) => s.setPageIndex);
  const editMode = useApp((s) => s.editMode);
  const setEditMode = useApp((s) => s.setEditMode);
  const updateProfile = useApp((s) => s.updateProfile);
  const toast = useApp((s) => s.toast);
  const pagerRef = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<number | undefined>(undefined);
  const [picker, setPicker] = useState(false);
  const [optionsFor, setOptionsFor] = useState<string | null>(null);

  const pageCount = profile.pages.length;
  const current = Math.min(pageIndex, pageCount - 1);

  // スワイプ（横スクロール + スナップ）で現在のページを判定
  const onScroll = () => {
    window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const el = pagerRef.current;
      if (!el || !el.clientWidth) return;
      setPageIndex(Math.round(el.scrollLeft / el.clientWidth));
    }, 90);
  };

  // ページ番号が他の操作で変わったらスクロール位置を合わせる
  useEffect(() => {
    const el = pagerRef.current;
    if (!el || !el.clientWidth) return;
    if (Math.round(el.scrollLeft / el.clientWidth) !== current) el.scrollTo({ left: current * el.clientWidth, behavior: 'smooth' });
  }, [current]);

  // 画面回転・リサイズ時に位置がずれないようにする
  useLayoutEffect(() => {
    const el = pagerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      el.scrollLeft = useApp.getState().pageIndex * el.clientWidth;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select, .sheet')) return;
      if (e.key === 'ArrowRight') setPageIndex(Math.min(pageCount - 1, useApp.getState().pageIndex + 1));
      if (e.key === 'ArrowLeft') setPageIndex(Math.max(0, useApp.getState().pageIndex - 1));
      if (e.key === 'Escape') setEditMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pageCount, setPageIndex, setEditMode]);

  const addPage = () => {
    updateProfile((p) => ({ ...p, pages: [...p.pages, { id: newPageId(), tiles: [] }] }));
    setPageIndex(pageCount);
  };

  const deletePage = () => {
    if (pageCount <= 1) return toast('最後のページは削除できません');
    const page = profile.pages[current];
    if (page.tiles.length && !window.confirm(`このページ（タイル${page.tiles.length}個）を削除しますか？`)) return;
    updateProfile((p) => ({ ...p, pages: p.pages.filter((_, i) => i !== current) }));
    setPageIndex(Math.max(0, current - 1));
  };

  const addTile = (type: string) => {
    const def = getTileDef(type);
    if (!def) return;
    let placedOn = current;
    updateProfile((p) => {
      const r = placeTile(p, current, { id: newId(`${type}-`), type, ...def.defaultSize }, limitsOf(type));
      placedOn = r.pageIndex;
      return r.profile;
    });
    setPicker(false);
    setPageIndex(placedOn);
    toast(placedOn === current ? `「${def.name}」を追加しました` : `「${def.name}」を ${placedOn + 1} ページ目に追加しました`);
  };

  const onDelete = useCallback(
    (tile: TileInstance) => {
      const name = getTileDef(tile.type)?.name ?? tile.type;
      if (!window.confirm(`「${name}」タイルを削除しますか？`)) return;
      updateProfile((p) => ({ ...p, pages: p.pages.map((pg) => ({ ...pg, tiles: pg.tiles.filter((t) => t.id !== tile.id) })) }));
    },
    [updateProfile],
  );

  const onOptions = useCallback((tile: TileInstance) => setOptionsFor(tile.id), []);

  /** タイルを別ページへ移す（端で長押し・設定ダイアログの移動ボタン） */
  const moveTileToPage = useCallback(
    (tileId: string, from: number, dir: -1 | 1, at?: { x: number; y: number }) => {
      let target = from + dir;
      let ok = true;
      updateProfile((p) => {
        if (target < 0) {
          ok = false;
          return p;
        }
        const tile = p.pages[from]?.tiles.find((t) => t.id === tileId);
        if (!tile) return p;
        if (target >= p.pages.length) p.pages.push({ id: newPageId(), tiles: [] });
        const dest = p.pages[target];
        let size = { w: tile.w, h: tile.h };
        let spot = findFreeSpot(size, dest.tiles, p.cols, p.rows, at);
        if (!spot) {
          size = clampSize(limitsOf(tile.type).minSize, limitsOf(tile.type), p.cols, p.rows);
          spot = findFreeSpot(size, dest.tiles, p.cols, p.rows, at);
        }
        if (!spot) {
          ok = false;
          target = from;
          return p;
        }
        p.pages[from].tiles = p.pages[from].tiles.filter((t) => t.id !== tileId);
        dest.tiles.push({ ...tile, ...size, ...spot });
        return p;
      });
      if (!ok) toast(target < 0 ? 'これより前のページはありません' : '移動先のページに空きがありません');
      else setPageIndex(target);
    },
    [updateProfile, setPageIndex, toast],
  );

  const optionsTile = optionsFor ? profile.pages.flatMap((p) => p.tiles).find((t) => t.id === optionsFor) : undefined;
  const optionsPage = optionsTile ? profile.pages.findIndex((p) => p.tiles.includes(optionsTile)) : -1;

  return (
    <>
      <div ref={pagerRef} className={`pager ${editMode ? 'is-editing' : ''}`} onScroll={onScroll}>
        {profile.pages.map((page, i) => (
          <section key={page.id} className="page" aria-label={`${i + 1} ページ目`}>
            <PageGrid
              page={page}
              pageIndex={i}
              cols={profile.cols}
              rows={profile.rows}
              onEdgeHold={moveTileToPage}
              onOptions={onOptions}
              onDelete={onDelete}
            />
            {page.tiles.length === 0 && !editMode && (
              <div className="page-empty">
                <p>このページは空です</p>
                <button type="button" className="btn btn--primary" onClick={() => setEditMode(true)}>
                  <Icon name="plus" size={18} /> タイルを追加
                </button>
              </div>
            )}
          </section>
        ))}
      </div>

      <nav className="page-dots" aria-label="ページ">
        {profile.pages.map((p, i) => (
          <button key={p.id} type="button" className={i === current ? 'is-active' : ''} aria-label={`${i + 1} ページ目へ`} onClick={() => setPageIndex(i)} />
        ))}
      </nav>

      {!editMode && (
        <div className="corner-actions">
          <button type="button" className="icon-btn glass" aria-label="ホーム画面を編集" onClick={() => setEditMode(true)}>
            <Icon name="grid" size={18} />
          </button>
          <button type="button" className="icon-btn glass" aria-label="設定" onClick={onOpenSettings}>
            <Icon name="gear" size={18} />
          </button>
        </div>
      )}

      {editMode && (
        <div className="edit-bar glass" role="toolbar" aria-label="編集">
          <button type="button" className="edit-bar-btn is-primary" onClick={() => setPicker(true)}>
            <Icon name="plus" size={18} />
            <span>タイル</span>
          </button>
          <button type="button" className="edit-bar-btn" onClick={addPage}>
            <Icon name="pages" size={18} />
            <span>ページ追加</span>
          </button>
          <button type="button" className="edit-bar-btn" onClick={deletePage} disabled={pageCount <= 1}>
            <Icon name="trash" size={18} />
            <span>ページ削除</span>
          </button>
          <button type="button" className="edit-bar-btn" onClick={onOpenSettings}>
            <Icon name="gear" size={18} />
            <span>設定</span>
          </button>
          <span className="edit-bar-page">
            {current + 1} / {pageCount}
          </span>
          <button type="button" className="edit-bar-btn is-done" onClick={() => setEditMode(false)}>
            <Icon name="check" size={18} />
            <span>完了</span>
          </button>
        </div>
      )}

      {picker && <TilePicker onPick={addTile} onClose={() => setPicker(false)} />}
      {optionsTile && (
        <TileOptionsDialog
          tile={optionsTile}
          pageIndex={optionsPage}
          pageCount={pageCount}
          onMove={(dir) => {
            moveTileToPage(optionsTile.id, optionsPage, dir);
            setOptionsFor(null);
          }}
          onClose={() => setOptionsFor(null)}
        />
      )}
    </>
  );
}
