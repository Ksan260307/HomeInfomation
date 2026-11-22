import { memo, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { TileInstance } from '../../shared/types';
import { Icon } from '../components/icons';
import { TileErrorBoundary, TileSizeContext, TileMessage, makeSizeInfo } from '../components/tileKit';
import { ACCENTS } from '../themes/themes';
import { getTileDef } from '../tiles/registry';

export type DragMode = 'move' | 'resize';

interface Props {
  tile: TileInstance;
  left: number;
  top: number;
  width: number;
  height: number;
  editMode: boolean;
  dragging: boolean;
  onDragStart(e: ReactPointerEvent, tile: TileInstance, mode: DragMode): void;
  onLongPress(): void;
  onOptions(tile: TileInstance): void;
  onDelete(tile: TileInstance): void;
}

const SCALE: Record<string, number> = { small: 0.86, normal: 1, large: 1.18, xlarge: 1.36 };

function TileFrameImpl({ tile, left, top, width, height, editMode, dragging, onDragStart, onLongPress, onOptions, onDelete }: Props) {
  const def = getTileDef(tile.type);
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);
  const size = useMemo(() => makeSizeInfo(width, height, tile.w, tile.h), [width, height, tile.w, tile.h]);
  const props = useMemo(() => ({ ...(def?.defaultProps ?? {}), ...(tile.props ?? {}) }), [def, tile.props]);

  const accent = ACCENTS.find((a) => a.id === props.accent)?.value;
  const surface = typeof props.surface === 'string' ? props.surface : 'glass';
  const style = {
    transform: `translate3d(${left}px, ${top}px, 0)`,
    width,
    height,
    ...(accent ? { '--accent': accent } : {}),
    '--tile-scale': SCALE[String(props.textScale)] ?? 1,
  } as CSSProperties;

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  // 通常モードで長押し → 編集モード（Android のホーム画面と同じ操作）
  const onPointerDown = (e: ReactPointerEvent) => {
    if (editMode || e.button > 0) return;
    cancelPress();
    press.current = {
      x: e.clientX,
      y: e.clientY,
      timer: window.setTimeout(() => {
        press.current = null;
        onLongPress();
      }, 600),
    };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 10) cancelPress();
  };

  const Comp = def?.component;
  const className = ['tile', `tile--${tile.type}`, `surface-${surface}`, `size-${size.size}`, editMode && 'is-editing', dragging && 'is-dragging', def?.bare && 'is-bare']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={style}
      data-tile-id={tile.id}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="tile-body">
        <TileSizeContext.Provider value={size}>
          <TileErrorBoundary resetKey={tile.type}>
            {Comp ? <Comp tile={tile} props={props} /> : <TileMessage icon="❓">不明なタイル: {tile.type}</TileMessage>}
          </TileErrorBoundary>
        </TileSizeContext.Provider>
      </div>

      {editMode && (
        <>
          <div className="tile-edit-shield" onPointerDown={(e) => onDragStart(e, tile, 'move')}>
            <span className="tile-edit-label">
              {def?.icon} {def?.name ?? tile.type}
              <small>
                {tile.w}×{tile.h}
              </small>
            </span>
          </div>
          <button
            type="button"
            className="tile-ctl tile-ctl-delete"
            aria-label="タイルを削除"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(tile)}
          >
            <Icon name="x" size={16} />
          </button>
          <button
            type="button"
            className="tile-ctl tile-ctl-options"
            aria-label="タイルの設定"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onOptions(tile)}
          >
            <Icon name="sliders" size={16} />
          </button>
          <div className="tile-resize" aria-label="サイズ変更" onPointerDown={(e) => onDragStart(e, tile, 'resize')}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M20 9v11H9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

export const TileFrame = memo(TileFrameImpl);
