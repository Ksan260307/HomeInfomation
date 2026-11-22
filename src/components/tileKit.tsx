import { Component, createContext, useContext, type ErrorInfo, type ReactNode } from 'react';

/**
 * タイル共通の部品。
 * - useTileSize: タイルの実寸から「表示サイズ区分」を求め、内容を自動で最適化するために使う
 * - TileHeader / TileMessage / Skeleton: 見た目をそろえるための部品
 */

export type SizeClass = 'xs' | 's' | 'm' | 'l' | 'xl';

export interface TileSizeInfo {
  width: number;
  height: number;
  /** グリッド上の列数・行数 */
  cols: number;
  rows: number;
  size: SizeClass;
  /** 横長（幅が高さの1.6倍以上） */
  wide: boolean;
  /** 縦長（高さが幅の1.5倍以上） */
  tall: boolean;
}

export function sizeClassOf(width: number, height: number): SizeClass {
  const m = Math.min(width, height);
  if (m < 120) return 'xs';
  if (m < 190) return 's';
  if (m < 310) return 'm';
  if (m < 470) return 'l';
  return 'xl';
}

export function makeSizeInfo(width: number, height: number, cols: number, rows: number): TileSizeInfo {
  return {
    width,
    height,
    cols,
    rows,
    size: sizeClassOf(width, height),
    wide: width >= height * 1.6,
    tall: height >= width * 1.5,
  };
}

export const TileSizeContext = createContext<TileSizeInfo>(makeSizeInfo(300, 300, 2, 2));
export const useTileSize = () => useContext(TileSizeContext);

/** サイズ区分の大小比較 */
const ORDER: SizeClass[] = ['xs', 's', 'm', 'l', 'xl'];
export const atLeast = (size: SizeClass, min: SizeClass) => ORDER.indexOf(size) >= ORDER.indexOf(min);

export function TileHeader({ icon, title, sub, right }: { icon?: ReactNode; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="tile-header">
      {icon && <span className="tile-header-icon">{icon}</span>}
      <span className="tile-header-title">{title}</span>
      {sub && <span className="tile-header-sub">{sub}</span>}
      {right && <span className="tile-header-right">{right}</span>}
    </header>
  );
}

export function TileMessage({ icon, children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="tile-message">
      {icon && <div className="tile-message-icon">{icon}</div>}
      <div>{children}</div>
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-label="読み込み中">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

/** 1つのタイルのエラーで画面全体が落ちないようにする */
export class TileErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { key: string }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[tile]', error, info.componentStack);
  }

  render() {
    if (this.state.error) return <TileMessage icon="⚠️">表示エラー: {this.state.error.message}</TileMessage>;
    return this.props.children;
  }
}

/** 外部リンク（iPad のホーム画面アプリからは Safari で開く） */
export function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
