import * as cheerio from 'cheerio';
import type { FeedItem, FlyerItem } from '../../shared/types';

// ---------------------------------------------------------------------------
// 阪神タイガース公式サイトのニュース一覧
// ---------------------------------------------------------------------------

export const TIGERS_OFFICIAL_NEWS_URL = 'https://hanshintigers.jp/news/';

/** 公式サイトのニュース一覧（<th class="date">[26/11/05]</th><td><a>見出し</a></td>）を解析する */
export function parseTigersOfficial(html: string, baseUrl = TIGERS_OFFICIAL_NEWS_URL): FeedItem[] {
  const $ = cheerio.load(html);
  const items: FeedItem[] = [];
  $('th.date').each((_, el) => {
    const row = $(el).closest('tr');
    const a = row.find('td a').first();
    const title = a.text().replace(/\s+/g, ' ').trim();
    const href = a.attr('href');
    if (!title || !href) return;
    const m = $(el)
      .text()
      .match(/(\d{2})\/(\d{1,2})\/(\d{1,2})/);
    const publishedAt = m ? new Date(2000 + Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime() : null;
    const link = new URL(href, baseUrl).toString();
    items.push({ id: `official:${link}`, title, link, source: '阪神タイガース公式', publishedAt });
  });
  return items;
}

// ---------------------------------------------------------------------------
// チラシ（トクバイの店舗ページ ほか一般的なページ）
// ---------------------------------------------------------------------------

const TOKUBAI_IMAGE = /https:\/\/image\.tokubai\.co\.jp\/images\/(bargain_office_leaflets|bargain_leaflets)\/([^/]+)\/(\d+)\.(jpg|jpeg|png|webp)(\?\d+)?/;

function widthOf(params: string): number {
  const m = params.match(/(?:^|,)w=(\d+)/);
  return m ? Number(m[1]) : 0;
}

export interface FlyerPage {
  name: string;
  flyers: FlyerItem[];
}

export function extractFlyers(html: string, pageUrl: string): FlyerPage {
  const $ = cheerio.load(html);
  const rawTitle = $('meta[property="og:title"]').attr('content') || $('title').first().text() || '';
  const name = rawTitle
    .replace(/のチラシ.*$/, '')
    .replace(/\s*[|｜].*$/, '')
    .trim();

  const host = new URL(pageUrl).host;
  const flyers: FlyerItem[] = [];

  if (host.endsWith('tokubai.co.jp')) {
    // 店舗ページの「チラシ」欄（#leaflet）にある画像だけを対象にする（近隣店舗のチラシを除外）
    const scope = $('#leaflet, .leaflet_component');
    const best = new Map<string, { kind: string; params: string; query: string; link: string }>();
    (scope.length ? scope : $('body')).find('img').each((_, img) => {
      const src = $(img).attr('data-src') || $(img).attr('src') || '';
      const m = src.match(TOKUBAI_IMAGE);
      if (!m) return;
      const [, kind, params, id, , query = ''] = m;
      const href = $(img).closest('a').attr('href');
      const link = href ? new URL(href, pageUrl).toString() : pageUrl;
      const prev = best.get(id);
      if (!prev || widthOf(params) > widthOf(prev.params)) best.set(id, { kind, params, query, link });
    });
    for (const [id, v] of best) {
      const base = `https://image.tokubai.co.jp/images/${v.kind}`;
      flyers.push({ thumb: `${base}/${v.params}/${id}.jpg${v.query}`, full: `${base}/o=true/${id}.jpg${v.query}`, link: v.link });
    }
  } else {
    const seen = new Set<string>();
    const push = (src?: string) => {
      if (!src) return;
      const abs = new URL(src, pageUrl).toString();
      if (seen.has(abs)) return;
      seen.add(abs);
      flyers.push({ thumb: abs, full: abs, link: pageUrl });
    };
    $('img').each((_, img) => {
      const src = $(img).attr('data-src') || $(img).attr('src');
      const alt = $(img).attr('alt') ?? '';
      if (src && (/(chirashi|leaflet|flyer|tirasi)/i.test(src) || /チラシ/.test(alt))) push(src);
    });
    if (flyers.length === 0) push($('meta[property="og:image"]').attr('content'));
  }

  return { name: name || host, flyers: flyers.slice(0, 20) };
}
