import { useState } from 'react';
import { TileHeader, atLeast, useTileSize } from '../components/tileKit';
import { FUN_FACTS } from '../data/funFacts';
import { useNow } from '../hooks/useNow';
import { periodIndex } from '../lib/utils';
import type { TileComponentProps } from './types';
import './funfact.css';

/**
 * トリビア（へぇ〜となる雑学・言葉の由来）。
 * クイズ形式ではなく、見出しと解説を最初から並べて「読む」豆知識カードとして表示する。
 * 一定時間ごとに自動で切り替わり、タップまたは「次へ」で好きなだけ読み進められる。
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
  const next = () => setSkip({ period, step: step + 1 });

  // 小さいタイル：解説だけを表示し、タップで次へ
  if (!atLeast(size.size, 's') || size.height < 150) {
    return (
      <button type="button" className="ff ff--mini" onClick={next} key={fact.id}>
        <span className="ff-title">{fact.q}</span>
        <span className="ff-text">{fact.a}</span>
      </button>
    );
  }

  return (
    <div className="ff">
      <TileHeader icon="🤔" title="トリビア" sub={fact.category} right={<span className="ff-count">No.{fact.id}</span>} />
      <article className="ff-body" key={fact.id} onClick={next}>
        <h3 className="ff-title ff-title--big">{fact.q}</h3>
        <p className="ff-text ff-text--big">{fact.a}</p>
      </article>
      <div className="ff-actions">
        <button type="button" className="ff-next" onClick={next}>
          次のトリビア ▶
        </button>
      </div>
    </div>
  );
}
