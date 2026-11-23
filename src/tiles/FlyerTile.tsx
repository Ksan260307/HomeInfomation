import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cleanStoreName, shortStoreNames } from '../../shared/storeName';
import type { FlyerResponse } from '../../shared/types';
import { Icon } from '../components/icons';
import { Skeleton, TileHeader, TileMessage, atLeast, openExternal, useTileSize } from '../components/tileKit';
import { useNow } from '../hooks/useNow';
import { useRemote } from '../hooks/useRemote';
import { useApp } from '../state/store';
import type { TileComponentProps } from './types';
import './flyer.css';

export interface FlatFlyer {
  key: string;
  storeId: string;
  store: string;
  /** そのお店の中で何枚目か（0始まり）と、そのお店の枚数 */
  nth: number;
  count: number;
  thumb: string;
  full: string;
  link: string;
}

export interface FlyerGroup {
  storeId: string;
  store: string;
  /** お店ボタン用の短い名前 */
  label: string;
  /** flyers 全体の中での先頭位置 */
  start: number;
  items: FlatFlyer[];
}

/** お店ごとのチラシを1列に並べる（お店の登録順を保つ） */
export function flattenFlyers(data: FlyerResponse, storeFilter = ''): FlatFlyer[] {
  return data.stores
    .filter((s) => !storeFilter || s.id === storeFilter)
    .flatMap((s) =>
      s.flyers.map((f, i) => ({
        key: `${s.id}-${i}`,
        storeId: s.id,
        store: cleanStoreName(s.name) || s.name,
        nth: i,
        count: s.flyers.length,
        ...f,
      })),
    );
}

/** 一覧表示用に、お店ごとにまとめる */
export function groupFlyers(flyers: FlatFlyer[]): FlyerGroup[] {
  const groups: FlyerGroup[] = [];
  flyers.forEach((f, i) => {
    const last = groups[groups.length - 1];
    if (last && last.storeId === f.storeId) last.items.push(f);
    else groups.push({ storeId: f.storeId, store: f.store, label: f.store, start: i, items: [f] });
  });
  const labels = shortStoreNames(groups.map((g) => g.store));
  groups.forEach((g, i) => (g.label = labels[i] || g.store));
  return groups;
}

/** お店ボタンで選んだ絞り込みは、しばらく触らなければ「すべて」に戻す */
export const PICK_RESET_MS = 5 * 60_000;

function FlyerGrid({ groups, current, onPick }: { groups: FlyerGroup[]; current: number; onPick(index: number): void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const currentStore = groups.find((g) => current >= g.start && current < g.start + g.items.length)?.storeId;

  const jump = (storeId: string, smooth = true) => {
    const el = sectionRefs.current.get(storeId);
    const box = scrollRef.current;
    if (!el || !box) return;
    if (smooth && typeof box.scrollTo === 'function') box.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
    else box.scrollTop = el.offsetTop;
  };

  // 開いたときは、いま見ていたお店の位置から表示する
  useEffect(() => {
    if (currentStore) jump(currentStore, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flyer-grid-wrap">
      {groups.length > 1 && (
        <nav className="flyer-chips flyer-chips--dark" aria-label="お店へ移動">
          {groups.map((g) => (
            <button key={g.storeId} type="button" className="chip-btn" title={g.store} onClick={() => jump(g.storeId)}>
              {g.label}
              <span className="flyer-chip-count">{g.items.length}</span>
            </button>
          ))}
        </nav>
      )}
      <div className="flyer-grid-scroll" ref={scrollRef}>
        {groups.map((g) => (
          <section
            key={g.storeId}
            className="flyer-grid-section"
            ref={(el) => {
              if (el) sectionRefs.current.set(g.storeId, el);
              else sectionRefs.current.delete(g.storeId);
            }}
          >
            <h3 className="flyer-grid-title">
              {g.store}
              <small>{g.items.length}枚</small>
            </h3>
            <div className="flyer-grid">
              {g.items.map((f, k) => {
                const idx = g.start + k;
                return (
                  <button
                    key={f.key}
                    type="button"
                    className={`flyer-grid-item ${idx === current ? 'is-current' : ''}`}
                    onClick={() => onPick(idx)}
                    aria-label={`${f.store}のチラシ ${k + 1}枚目を開く`}
                  >
                    <img src={f.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function FlyerViewer({
  flyers,
  start,
  startInGrid = false,
  onClose,
}: {
  flyers: FlatFlyer[];
  start: number;
  startInGrid?: boolean;
  onClose(): void;
}) {
  const [i, setI] = useState(start);
  const [zoom, setZoom] = useState(false);
  const [grid, setGrid] = useState(startInGrid);
  const f = flyers[Math.min(i, flyers.length - 1)];
  const go = (d: number) => {
    setZoom(false);
    setI((x) => (x + d + flyers.length) % flyers.length);
  };
  const pick = (idx: number) => {
    setZoom(false);
    setI(idx);
    setGrid(false);
  };
  return createPortal(
    <div className="flyer-viewer" role="dialog" aria-modal="true" aria-label="チラシ">
      <header className="flyer-viewer-bar">
        <span className="flyer-viewer-title">
          {grid ? 'チラシ一覧' : f.store}
          <small>{grid ? `全${flyers.length}枚` : `${f.nth + 1} / ${f.count}枚目 ・ 全${flyers.length}枚`}</small>
        </span>
        {flyers.length > 1 && (
          <button
            type="button"
            className={`btn glass flyer-mode-btn ${grid ? 'is-active' : ''}`}
            aria-pressed={grid}
            onClick={() => setGrid((g) => !g)}
          >
            <Icon name="grid" size={16} />
            一覧
          </button>
        )}
        {!grid && (
          <button type="button" className="icon-btn glass" aria-label="お店のページを開く" onClick={() => openExternal(f.link)}>
            <Icon name="external" size={18} />
          </button>
        )}
        <button type="button" className="icon-btn glass" aria-label="閉じる" onClick={onClose}>
          <Icon name="x" />
        </button>
      </header>
      {grid ? (
        <FlyerGrid groups={groupFlyers(flyers)} current={i} onPick={pick} />
      ) : (
        <>
          <div className={`flyer-viewer-scroll ${zoom ? 'is-zoom' : ''}`} onDoubleClick={() => setZoom((z) => !z)}>
            <img key={f.key} src={f.full} alt={`${f.store}のチラシ`} referrerPolicy="no-referrer" />
          </div>
          {flyers.length > 1 && (
            <>
              <button type="button" className="flyer-nav is-prev icon-btn glass" aria-label="前のチラシ" onClick={() => go(-1)}>
                <Icon name="chevronLeft" />
              </button>
              <button type="button" className="flyer-nav is-next icon-btn glass" aria-label="次のチラシ" onClick={() => go(1)}>
                <Icon name="chevronRight" />
              </button>
            </>
          )}
          <button type="button" className="flyer-zoom btn glass" onClick={() => setZoom((z) => !z)}>
            {zoom ? '全体を表示' : '拡大する'}
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}

export function FlyerTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const office = useApp((s) => s.settings.location.jmaOffice);
  const { data, error } = useRemote<FlyerResponse>('/flyers', 3 * 3600_000);
  const intervalSec = Math.max(4, Number(props.interval) || 12);
  const now = useNow(1000);
  const [offset, setOffset] = useState(0);
  const [viewer, setViewer] = useState<{ index: number; grid: boolean } | null>(null);
  const [picked, setPicked] = useState<{ id: string; at: number } | null>(null);

  // 都道府県コード（気象庁の府県予報区コードの先頭2桁がほぼ JIS コードと一致）
  const pref = Math.min(47, Math.max(1, parseInt(office.slice(0, 2), 10) || 27));
  const searchUrl = `https://tokubai.co.jp/prefectures/${pref}`;

  if (!data) return error ? <TileMessage icon="🛒">チラシを取得できません</TileMessage> : <Skeleton lines={4} />;
  if (!data.stores.length) {
    return (
      <div className="flyer">
        <TileHeader icon="🛒" title="今週のチラシ" />
        <TileMessage icon="🗺️">
          設定 → チラシ でよく行くお店のページ（トクバイ）を登録してください
          {atLeast(size.size, 's') && (
            <div>
              <button type="button" className="btn btn--primary flyer-search" onClick={() => openExternal(searchUrl)}>
                地域のお店を探す
              </button>
            </div>
          )}
        </TileMessage>
      </div>
    );
  }

  const all = flattenFlyers(data, String(props.store ?? ''));
  const errors = data.stores.filter((s) => s.error);

  if (!all.length) {
    return (
      <div className="flyer">
        <TileHeader icon="🛒" title="今週のチラシ" />
        <TileMessage icon="📭">{errors.length ? `取得エラー: ${errors[0].error}` : '現在掲載中のチラシはありません'}</TileMessage>
      </div>
    );
  }

  const groups = groupFlyers(all);
  // お店ボタンで選んだお店（時間がたったら、またはお店が消えたら「すべて」に戻す）
  const pickId = picked && now - picked.at < PICK_RESET_MS && groups.some((g) => g.storeId === picked.id) ? picked.id : '';
  const flyers = pickId ? all.filter((f) => f.storeId === pickId) : all;
  const choose = (id: string) => {
    setPicked(id ? { id, at: Date.now() } : null);
    setOffset(0);
  };
  const touch = () => {
    if (pickId) setPicked({ id: pickId, at: Date.now() });
  };

  const showHeader = size.size !== 'xs';
  const showChips = groups.length > 1 && atLeast(size.size, 's') && size.height >= 180;

  // 横長なら複数枚並べる
  const reserved = (showHeader ? 34 : 0) + (showChips ? 38 : 0);
  const visible = Math.max(1, Math.min(flyers.length, Math.floor(size.width / Math.max(160, (size.height - reserved) * 0.62))));
  const base = Math.floor(now / 1000 / intervalSec) + offset;
  const shown = Array.from({ length: visible }, (_, k) => (((base * visible + k) % flyers.length) + flyers.length) % flyers.length);
  const open = (flyer: FlatFlyer | null, grid: boolean) => {
    touch();
    setViewer({ index: flyer ? all.indexOf(flyer) : 0, grid });
  };
  const step = (d: number) => {
    touch();
    setOffset((o) => o + d);
  };

  return (
    <div className="flyer">
      {showHeader && (
        <TileHeader
          icon="🛒"
          title="今週のチラシ"
          sub={pickId ? `${flyers.length} / ${all.length}枚` : `${all.length}枚`}
          right={
            atLeast(size.size, 's') ? (
              <span className="flyer-arrows">
                {flyers.length > visible && (
                  <>
                    <button type="button" className="icon-btn" aria-label="前へ" onClick={() => step(-1)}>
                      <Icon name="chevronLeft" size={18} />
                    </button>
                    <button type="button" className="icon-btn" aria-label="次へ" onClick={() => step(1)}>
                      <Icon name="chevronRight" size={18} />
                    </button>
                  </>
                )}
                {all.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="チラシを一覧で見る"
                    title="一覧で見る"
                    onClick={() => open(pickId ? flyers[0] : null, true)}
                  >
                    <Icon name="grid" size={17} />
                  </button>
                )}
              </span>
            ) : undefined
          }
        />
      )}
      {showChips && (
        <nav className="flyer-chips" aria-label="お店で絞り込む">
          <button type="button" className={`chip-btn ${!pickId ? 'is-active' : ''}`} aria-pressed={!pickId} onClick={() => choose('')}>
            すべて
          </button>
          {groups.map((g) => (
            <button
              key={g.storeId}
              type="button"
              className={`chip-btn ${pickId === g.storeId ? 'is-active' : ''}`}
              aria-pressed={pickId === g.storeId}
              title={g.store}
              onClick={() => choose(pickId === g.storeId ? '' : g.storeId)}
            >
              {g.label}
              <span className="flyer-chip-count">{g.items.length}</span>
            </button>
          ))}
        </nav>
      )}
      <div className="flyer-strip" style={{ gridTemplateColumns: `repeat(${visible}, 1fr)` }}>
        {shown.map((idx) => {
          const f = flyers[idx];
          return (
            <button key={`${f.key}-${idx}`} type="button" className="flyer-card" onClick={() => open(f, false)}>
              <img src={f.thumb} alt={`${f.store}のチラシ`} loading="lazy" referrerPolicy="no-referrer" />
              <span className="flyer-store">
                {f.store}
                {f.count > 1 && <small>{` ${f.nth + 1}/${f.count}`}</small>}
              </span>
            </button>
          );
        })}
      </div>
      {viewer !== null && (
        <FlyerViewer flyers={all} start={viewer.index} startInGrid={viewer.grid} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
