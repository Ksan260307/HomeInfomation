import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { FlyerResponse } from '../../shared/types';
import { Icon } from '../components/icons';
import { Skeleton, TileHeader, TileMessage, atLeast, openExternal, useTileSize } from '../components/tileKit';
import { useNow } from '../hooks/useNow';
import { useRemote } from '../hooks/useRemote';
import { useApp } from '../state/store';
import type { TileComponentProps } from './types';
import './flyer.css';

interface FlatFlyer {
  key: string;
  store: string;
  thumb: string;
  full: string;
  link: string;
}

function FlyerViewer({ flyers, start, onClose }: { flyers: FlatFlyer[]; start: number; onClose(): void }) {
  const [i, setI] = useState(start);
  const [zoom, setZoom] = useState(false);
  const f = flyers[i];
  const go = (d: number) => {
    setZoom(false);
    setI((x) => (x + d + flyers.length) % flyers.length);
  };
  return createPortal(
    <div className="flyer-viewer" role="dialog" aria-modal="true">
      <header className="flyer-viewer-bar">
        <span className="flyer-viewer-title">
          {f.store}
          <small>
            {i + 1} / {flyers.length}
          </small>
        </span>
        <button type="button" className="icon-btn glass" aria-label="お店のページを開く" onClick={() => openExternal(f.link)}>
          <Icon name="external" size={18} />
        </button>
        <button type="button" className="icon-btn glass" aria-label="閉じる" onClick={onClose}>
          <Icon name="x" />
        </button>
      </header>
      <div className={`flyer-viewer-scroll ${zoom ? 'is-zoom' : ''}`} onDoubleClick={() => setZoom((z) => !z)}>
        <img src={f.full} alt={`${f.store}のチラシ`} referrerPolicy="no-referrer" />
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
  const [viewer, setViewer] = useState<number | null>(null);

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

  const storeFilter = String(props.store ?? '');
  const flyers: FlatFlyer[] = data.stores
    .filter((s) => !storeFilter || s.id === storeFilter)
    .flatMap((s) => s.flyers.map((f, i) => ({ key: `${s.id}-${i}`, store: s.name, ...f })));
  const errors = data.stores.filter((s) => s.error);

  if (!flyers.length) {
    return (
      <div className="flyer">
        <TileHeader icon="🛒" title="今週のチラシ" />
        <TileMessage icon="📭">{errors.length ? `取得エラー: ${errors[0].error}` : '現在掲載中のチラシはありません'}</TileMessage>
      </div>
    );
  }

  // 横長なら複数枚並べる
  const visible = Math.max(1, Math.min(flyers.length, Math.floor(size.width / Math.max(160, size.height * 0.62))));
  const base = Math.floor(now / 1000 / intervalSec) + offset;
  const shown = Array.from({ length: visible }, (_, k) => (((base * visible + k) % flyers.length) + flyers.length) % flyers.length);

  return (
    <div className="flyer">
      {size.size !== 'xs' && (
        <TileHeader
          icon="🛒"
          title="今週のチラシ"
          sub={`${flyers.length}枚`}
          right={
            atLeast(size.size, 's') && flyers.length > visible ? (
              <span className="flyer-arrows">
                <button type="button" className="icon-btn" aria-label="前へ" onClick={() => setOffset((o) => o - 1)}>
                  <Icon name="chevronLeft" size={18} />
                </button>
                <button type="button" className="icon-btn" aria-label="次へ" onClick={() => setOffset((o) => o + 1)}>
                  <Icon name="chevronRight" size={18} />
                </button>
              </span>
            ) : undefined
          }
        />
      )}
      <div className="flyer-strip" style={{ gridTemplateColumns: `repeat(${visible}, 1fr)` }}>
        {shown.map((idx) => {
          const f = flyers[idx];
          return (
            <button key={`${f.key}-${idx}`} type="button" className="flyer-card" onClick={() => setViewer(idx)}>
              <img src={f.thumb} alt={`${f.store}のチラシ`} loading="lazy" referrerPolicy="no-referrer" />
              <span className="flyer-store">{f.store}</span>
            </button>
          );
        })}
      </div>
      {viewer !== null && <FlyerViewer flyers={flyers} start={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
