import type { FeedItem, FeedResponse } from '../../shared/types';
import { Skeleton, TileHeader, TileMessage, atLeast, openExternal, useTileSize } from '../components/tileKit';
import { useNow } from '../hooks/useNow';
import { useRemote } from '../hooks/useRemote';
import { relativeTime } from '../lib/utils';
import { useApp } from '../state/store';
import type { TileComponentProps } from './types';
import './feed.css';

function FeedList({ items, now, showImages }: { items: FeedItem[]; now: number; showImages: boolean }) {
  return (
    <ul className="feed-list">
      {items.map((it) => (
        <li key={it.id}>
          <button type="button" className="feed-item" onClick={() => openExternal(it.link)}>
            {showImages && it.image && <img className="feed-thumb" src={it.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
            <span className="feed-text">
              <span className="feed-title">{it.title}</span>
              <span className="feed-meta">
                <span className="feed-source">{it.source}</span>
                {it.publishedAt && <span>{relativeTime(it.publishedAt, now)}</span>}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** 小さいタイル用: 見出しを1件ずつ自動で切り替えて表示 */
function Ticker({ items, now }: { items: FeedItem[]; now: number }) {
  const index = Math.floor(now / 10_000) % items.length;
  const it = items[index];
  return (
    <button type="button" className="feed-ticker" onClick={() => openExternal(it.link)} key={it.id}>
      <span className="feed-ticker-title">{it.title}</span>
      <span className="feed-meta">
        <span className="feed-source">{it.source}</span>
        {it.publishedAt && <span>{relativeTime(it.publishedAt, now)}</span>}
      </span>
    </button>
  );
}

function FeedBody({ data, error, emptyText }: { data?: FeedResponse; error?: string; emptyText: string }) {
  const size = useTileSize();
  const now = useNow(10_000);
  if (!data) return error ? <TileMessage icon="🌐">取得できません: {error}</TileMessage> : <Skeleton lines={4} />;
  if (!data.items.length) return <TileMessage icon="📭">{data.errors[0] ?? emptyText}</TileMessage>;
  if (!atLeast(size.size, 'm') && size.height < 260) return <Ticker items={data.items} now={now} />;
  return <FeedList items={data.items} now={now} showImages={size.width > 380} />;
}

const TIGERS_LINKS = [
  { label: '公式', url: 'https://hanshintigers.jp/', icon: '🐯' },
  { label: 'X', url: 'https://x.com/tigersdreamlink', icon: '𝕏' },
  { label: 'Instagram', url: 'https://www.instagram.com/hanshintigers_official/', icon: '📷' },
  { label: 'LINE', url: 'https://page.line.me/hanshintigers', icon: '💬' },
  { label: 'YouTube', url: 'https://www.youtube.com/channel/UCqm35j3ustKFyXQVnX5tlXw', icon: '▶️' },
];

export function TigersTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const { data, error } = useRemote<FeedResponse>('/feeds/tigers', 15 * 60_000);
  const filter = String(props.source ?? 'all');
  const filtered = data && filter === 'official' ? { ...data, items: data.items.filter((i) => i.source.includes('公式')) } : data;
  const showLinks = props.links !== false && atLeast(size.size, 'm') && size.height > 250;
  return (
    <div className="feed feed--tigers">
      {size.size !== 'xs' && <TileHeader icon="🐯" title="阪神タイガース" sub={filter === 'official' ? '公式' : 'ニュース'} />}
      <div className="feed-body">
        <FeedBody data={filtered} error={error} emptyText="ニュースはまだありません" />
      </div>
      {showLinks && (
        <div className="feed-links">
          {TIGERS_LINKS.map((l) => (
            <button key={l.label} type="button" className="chip-btn" onClick={() => openExternal(l.url)}>
              <span>{l.icon}</span>
              {size.width > 420 && <span>{l.label}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function NewsTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const feeds = useApp((s) => s.settings.news.feeds);
  const feedId = String(props.feed ?? 'yahoo-top');
  const feed = feeds.find((f) => f.id === feedId);
  const { data, error } = useRemote<FeedResponse>(`/feeds/news?feed=${encodeURIComponent(feedId)}`, 10 * 60_000);
  return (
    <div className="feed">
      {size.size !== 'xs' && <TileHeader icon="📰" title="ニュース" sub={feedId === 'enabled' ? 'まとめ' : feed?.name} />}
      <div className="feed-body">
        <FeedBody data={data} error={error} emptyText="ニュースはまだありません" />
      </div>
    </div>
  );
}
