import type { CSSProperties } from 'react';
import { TileHeader, TileMessage, atLeast, useTileSize } from '../components/tileKit';
import { useApp } from '../state/store';
import type { TileComponentProps } from './types';
import './shortcut.css';

/** 開いてよいURLか（javascript: などの危険なスキームは拒否） */
export function isSafeShortcutUrl(url: string): boolean {
  const m = url.trim().match(/^([a-z][a-z0-9+.-]*):/i);
  if (!m) return false;
  return !['javascript', 'data', 'vbscript', 'file', 'blob'].includes(m[1].toLowerCase());
}

/** https はブラウザ（ユニバーサルリンク対応アプリ）で、独自スキームはアプリを直接開く */
export function openShortcut(url: string) {
  const u = url.trim();
  if (!isSafeShortcutUrl(u)) return;
  if (/^https?:/i.test(u)) window.open(u, '_blank', 'noopener,noreferrer');
  else window.location.href = u;
}

/**
 * ショートカット：よく使うアプリやサイトをワンタップで開くボタンを並べる。
 * ボタンは 設定 → ショートカット で登録する（全タイル共通）。
 */
export function ShortcutTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const items = useApp((s) => s.settings.shortcuts?.items ?? []).filter((i) => i.url && isSafeShortcutUrl(i.url));
  if (!items.length) return <TileMessage icon="🔗">設定 → ショートカット で開きたいアプリやサイトを登録してください</TileMessage>;

  const showHeader = props.header !== false && atLeast(size.size, 'm') && size.height > 200;
  const avail = { w: size.width - 8, h: size.height - (showHeader ? 40 : 0) - 8 };
  // ボタンが収まる列数を、正方形に近い形になるよう計算
  let cols = 1;
  for (let c = 1; c <= items.length; c++) {
    const rows = Math.ceil(items.length / c);
    const cell = Math.min(avail.w / c, avail.h / rows);
    const best = Math.min(avail.w / cols, avail.h / Math.ceil(items.length / cols));
    if (cell > best) cols = c;
  }
  const rows = Math.ceil(items.length / cols);
  const cell = Math.min(avail.w / cols, avail.h / rows);
  const showLabel = props.labels !== false && cell > 74;

  return (
    <div className="sc">
      {showHeader && <TileHeader icon="🔗" title="ショートカット" />}
      <div className="sc-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className="sc-btn"
            style={{ '--sc': it.color || 'var(--accent)', '--sc-size': `${Math.round(cell)}px` } as CSSProperties}
            onClick={() => openShortcut(it.url)}
            title={it.name}
          >
            <span className="sc-icon">{it.icon || '🔗'}</span>
            {showLabel && <span className="sc-name">{it.name}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
