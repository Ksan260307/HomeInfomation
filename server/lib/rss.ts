import { XMLParser } from 'fast-xml-parser';
import type { FeedItem } from '../../shared/types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
});

type Node = Record<string, unknown>;

const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object' && '#text' in (v as Node)) return text((v as Node)['#text']);
  return '';
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(v: unknown): number | null {
  const s = text(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function atomLink(v: unknown): string {
  const links = asArray(v as Node | Node[]);
  const alt = links.find((l) => typeof l === 'object' && (!l['@_rel'] || l['@_rel'] === 'alternate'));
  const pick = alt ?? links[0];
  if (typeof pick === 'string') return pick;
  return pick ? text(pick['@_href']) : '';
}

function findImage(item: Node): string | undefined {
  const candidates: unknown[] = [
    ...asArray(item['media:thumbnail'] as Node | Node[]).map((m) => m?.['@_url']),
    ...asArray(item['media:content'] as Node | Node[]).map((m) => m?.['@_url']),
    ...asArray(item['enclosure'] as Node | Node[])
      .filter((e) => String(e?.['@_type'] ?? '').startsWith('image'))
      .map((e) => e?.['@_url']),
  ];
  const fromField = candidates.map(text).find(Boolean);
  if (fromField) return fromField;
  const html = text(item['description']) + text(item['content:encoded']) + text(item['content']);
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1];
}

/** RSS 2.0 / Atom / RSS 1.0(RDF) を共通の FeedItem に変換する */
export function parseFeed(xml: string, sourceName: string): FeedItem[] {
  const doc = parser.parse(xml) as Node;
  let rawItems: Node[] = [];
  let kind: 'rss' | 'atom' = 'rss';

  const rss = doc['rss'] as Node | undefined;
  const feed = doc['feed'] as Node | undefined;
  const rdf = doc['rdf:RDF'] as Node | undefined;
  if (rss) rawItems = asArray((rss['channel'] as Node | undefined)?.['item'] as Node | Node[]);
  else if (feed) {
    rawItems = asArray(feed['entry'] as Node | Node[]);
    kind = 'atom';
  } else if (rdf) rawItems = asArray(rdf['item'] as Node | Node[]);
  else throw new Error('RSS/Atom として解析できませんでした');

  return rawItems
    .map((item, i): FeedItem | null => {
      let title = stripHtml(text(item['title']));
      const link = kind === 'atom' ? atomLink(item['link']) : text(item['link']) || text(item['guid']);
      if (!title || !link) return null;
      // Google ニュースは「見出し - 媒体名」形式なので媒体名を分離する
      let source = text(item['source']) || sourceName;
      if (source !== sourceName && title.endsWith(` - ${source}`)) {
        title = title.slice(0, -(source.length + 3));
      } else if (!item['source']) {
        source = sourceName;
      }
      const publishedAt =
        parseDate(item['pubDate']) ??
        parseDate(item['dc:date']) ??
        parseDate(item['published']) ??
        parseDate(item['updated']);
      return {
        id: `${sourceName}:${text(item['guid']) || link || i}`,
        title,
        link,
        source,
        publishedAt,
        image: findImage(item),
      };
    })
    .filter((x): x is FeedItem => x !== null);
}

/** 重複（同じリンク・同じ見出し）を除いて新しい順に並べる */
export function mergeFeedItems(lists: FeedItem[][], limit = 60): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const item of lists.flat().sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))) {
    const key = item.title.replace(/\s+/g, '');
    if (seen.has(item.link) || seen.has(key)) continue;
    seen.add(item.link);
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}
