import { useState } from 'react';
import { TileHeader, atLeast, useTileSize } from '../components/tileKit';
import { FUN_FACTS } from '../data/funFacts';
import { useNow } from '../hooks/useNow';
import { periodIndex } from '../lib/utils';
import type { TileComponentProps } from './types';
import './funfact.css';

/**
 * トリビア（へぇ〜となる雑学・言葉の由来）。一定時間ごとに自動で切り替わり、
 * タップで答え（解説）を表示、「次へ」で好きなだけ読み進められる。
 */
export function FunFactTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const now = useNow(30_000);
  const minutes = Math.min(24 * 60, Math.max(1, Number(props.interval) || 30));
  const periodMs = minutes * 60_000;
  const period = Math.floor(now / periodMs);
  const [skip, setSkip] = useState({ period, step: 0 });
  const step = skip.period === period ? skip.step : 0;
  const { index } = periodIndex(now, FUN_FACTS.length, periodMs, 31, step);
  const fact = FUN_FACTS[index];
  const [openId, setOpenId] = useState<number | null>(null);
  const showAll = props.reveal === 'always';
  const open = showAll || openId === fact.id;

  const next = () => setSkip({ period, step: step + 1 });
  const toggle = () => setOpenId(open && !showAll ? null : fact.id);

  if (!atLeast(size.size, 's') || size.height < 150) {
    return (
      <button type="button" className={`ff ff--mini ${open ? 'is-open' : ''}`} onClick={open ? next : toggle}>
        <span className="ff-q">{open ? fact.a : fact.q}</span>
        <span className="ff-hint">{open ? 'タップで次へ' : 'タップで答え'}</span>
      </button>
    );
  }

  return (
    <div className="ff">
      <TileHeader icon="🤔" title="トリビア" sub={fact.category} right={<span className="ff-count">No.{fact.id}</span>} />
      <button type="button" className="ff-body" onClick={toggle}>
        <span className="ff-q ff-q--big">{fact.q}</span>
        {open ? (
          <span className="ff-a" key={fact.id}>
            <span className="ff-a-mark">💡</span>
            {fact.a}
          </span>
        ) : (
          <span className="ff-tap">タップして答えを見る</span>
        )}
      </button>
      <div className="ff-actions">
        <button type="button" className="ff-next" onClick={next}>
          次のトリビア ▶
        </button>
      </div>
    </div>
  );
}
