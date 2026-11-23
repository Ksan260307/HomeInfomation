import { describe, expect, it } from 'vitest';
import { parseIcs } from './ics';
import { buildAreaList, parseWarnings } from './jma';
import { mergeFeedItems, parseFeed } from './rss';
import { extractFlyers, parseTigersOfficial } from './scrape';
import { expandTimeTreeEvents } from './timetree';

describe('rss', () => {
  it('parses RSS 2.0 and splits the Google News source', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
      <item><title>阪神が勝利 - デイリースポーツ</title><link>https://example.com/a</link><pubDate>Sun, 22 Nov 2026 10:00:00 GMT</pubDate><source url="https://daily.co.jp">デイリースポーツ</source></item>
      <item><title>見出し&amp;テスト</title><link>https://example.com/b</link><description>&lt;img src="https://img.example.com/x.jpg"&gt;本文</description></item>
    </channel></rss>`;
    const items = parseFeed(xml, 'Googleニュース');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: '阪神が勝利', source: 'デイリースポーツ', link: 'https://example.com/a' });
    expect(items[0].publishedAt).toBe(Date.UTC(2026, 10, 22, 10));
    expect(items[1]).toMatchObject({ title: '見出し&テスト', source: 'Googleニュース', image: 'https://img.example.com/x.jpg' });
  });

  it('parses Atom feeds', () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom記事</title><link rel="alternate" href="https://example.com/atom"/><updated>2026-11-20T00:00:00Z</updated></entry></feed>`;
    expect(parseFeed(xml, 'atom')[0]).toMatchObject({ title: 'Atom記事', link: 'https://example.com/atom' });
  });

  it('merges and de-duplicates newest first', () => {
    const a = { id: '1', title: 'A', link: 'l1', source: 's', publishedAt: 1 };
    const b = { id: '2', title: 'B', link: 'l2', source: 's', publishedAt: 2 };
    const dup = { ...a, id: '3' };
    expect(mergeFeedItems([[a], [b, dup]]).map((i) => i.title)).toEqual(['B', 'A']);
  });
});

describe('scrapers', () => {
  it('parses the Tigers official news list', () => {
    const html = `<table><tr><th class="icon"><img alt="info"></th><th class="date">[26/11/05]</th><td><a href="/news/topics/info_1.html">記念グッズ発売</a></td></tr></table>`;
    const items = parseTigersOfficial(html);
    expect(items[0]).toMatchObject({ title: '記念グッズ発売', link: 'https://hanshintigers.jp/news/topics/info_1.html', source: '阪神タイガース公式' });
    expect(new Date(items[0].publishedAt!).getMonth()).toBe(10);
  });

  it('extracts only the shop flyers from a Tokubai page', () => {
    const html = `<html><head><title>イオン 札幌平岡店のチラシ・特売情報 | くふう トクバイ</title></head><body>
      <section id="leaflet"><a href="/x/1/leaflets/9"><img data-src="https://image.tokubai.co.jp/images/bargain_office_leaflets/w=552,h=444,mc=true/100.jpg?1" src=""></a>
      <img data-src="https://image.tokubai.co.jp/images/bargain_office_leaflets/w=100,h=137,c=true/100.jpg?1"></section>
      <section class="nearby"><img src="https://image.tokubai.co.jp/images/bargain_office_leaflets/w=240,h=240,c=true/999.jpg"></section></body></html>`;
    const page = extractFlyers(html, 'https://tokubai.co.jp/x/1');
    expect(page.name).toBe('イオン 札幌平岡店');
    expect(page.flyers).toHaveLength(1);
    expect(page.flyers[0].thumb).toContain('w=552');
    expect(page.flyers[0].full).toBe('https://image.tokubai.co.jp/images/bargain_office_leaflets/o=true/100.jpg?1');
    expect(page.flyers[0].link).toBe('https://tokubai.co.jp/x/1/leaflets/9');
  });

  it('ignores nearby shops when a Tokubai page has no flyer section', () => {
    const html = `<html><head><title>無印良品 天美店の新商品・クーポン | トクバイ</title></head><body>
      <a href="/%E3%83%A9%E3%82%A4%E3%83%95/5/leaflets/1"><img src="https://image.tokubai.co.jp/images/bargain_office_leaflets/w=240,h=240,c=true/500.jpg"></a>
      <a href="/%E7%84%A1%E5%8D%B0/7/leaflets/2"><img src="https://image.tokubai.co.jp/images/bargain_office_leaflets/w=240,h=240,c=true/600.jpg"></a>
      </body></html>`;
    const page = extractFlyers(html, 'https://tokubai.co.jp/%E7%84%A1%E5%8D%B0/7');
    expect(page.name).toBe('無印良品 天美店');
    expect(page.flyers.map((f) => f.link)).toEqual(['https://tokubai.co.jp/%E7%84%A1%E5%8D%B0/7/leaflets/2']);
    expect(extractFlyers(html, 'https://tokubai.co.jp/%E7%84%A1%E5%8D%B0/8').flyers).toEqual([]);
  });
});

describe('jma', () => {
  const data = [
    {
      reportDatetime: '2026-11-15T13:29:00+09:00',
      headlineText: '古い発表',
      warning: { class20Items: [{ areaCode: '2710000', kinds: [{ code: '10', status: '発表' }] }] },
    },
    {
      reportDatetime: '2026-11-21T04:17:00+09:00',
      headlineText: '乾燥に注意',
      warning: {
        class20Items: [
          {
            areaCode: '2710000',
            kinds: [
              { code: '21', status: '発表' },
              { code: '43', status: '継続' },
              { code: '10', status: '解除' },
            ],
          },
        ],
      },
    },
  ];

  it('returns active warnings from the latest report, highest level first', () => {
    const r = parseWarnings(data, '2710000');
    expect(r.headline).toBe('乾燥に注意');
    expect(r.items.map((i) => i.name)).toEqual(['レベル4大雨危険警報', '乾燥注意報']);
  });

  it('builds office → city lists', () => {
    const list = buildAreaList({
      offices: { '270000': { name: '大阪府' } },
      class10s: { '270000': { name: '大阪府', parent: '270000' } },
      class15s: { '270001': { name: '大阪市', parent: '270000' } },
      class20s: { '2710000': { name: '大阪市', parent: '270001' } },
    });
    expect(list.cities['270000']).toEqual([{ code: '2710000', name: '大阪市' }]);
  });
});

describe('calendar', () => {
  const from = Date.UTC(2026, 10, 21, 15); // 2026-11-22 00:00 JST
  const to = from + 31 * 86400_000;

  it('expands ICS recurring events with EXDATE and all-day events', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:weekly',
      'SUMMARY:ゴミ当番',
      'DTSTART;TZID=Asia/Tokyo:20261102T080000',
      'DTEND;TZID=Asia/Tokyo:20261102T083000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'EXDATE;TZID=Asia/Tokyo:20261130T080000',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:allday',
      'SUMMARY:旅行',
      'DTSTART;VALUE=DATE:20261128',
      'DTEND;VALUE=DATE:20261130',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const events = parseIcs(ics, 'test', from, to);
    const weekly = events.filter((e) => e.title === 'ゴミ当番');
    // 11/23, 12/7, 12/14, 12/21（11/30 は除外）
    expect(weekly.map((e) => new Date(e.start + 9 * 3600_000).toISOString().slice(0, 10))).toEqual(['2026-11-23', '2026-12-07', '2026-12-14', '2026-12-21']);
    expect(new Date(weekly[0].start).toISOString()).toBe('2026-11-22T23:00:00.000Z');
    const trip = events.find((e) => e.title === '旅行')!;
    expect(trip.allDay).toBe(true);
    expect(trip.end - trip.start).toBeLessThan(2 * 86400_000);
  });

  it('expands TimeTree events and skips memos', () => {
    const raw = [
      { uuid: 'a', title: '保育園', start_at: Date.UTC(2026, 10, 23, 0), end_at: Date.UTC(2026, 10, 23, 1), start_timezone: 'Asia/Tokyo', recurrences: ['RRULE:FREQ=DAILY;COUNT=3'] },
      { uuid: 'b', title: 'メモ', start_at: Date.UTC(2026, 10, 23), end_at: Date.UTC(2026, 10, 23), category: 2 },
      { uuid: 'c', title: '誕生日会', start_at: Date.UTC(2026, 11, 5), end_at: Date.UTC(2026, 11, 5), all_day: true, start_timezone: 'UTC' },
    ];
    const events = expandTimeTreeEvents(raw, 'TimeTree', from, to);
    expect(events.filter((e) => e.title === '保育園')).toHaveLength(3);
    expect(events.some((e) => e.title === 'メモ')).toBe(false);
    const bd = events.find((e) => e.title === '誕生日会')!;
    expect(bd.allDay).toBe(true);
    expect(new Date(bd.start + 9 * 3600_000).toISOString().slice(0, 10)).toBe('2026-12-05');
  });
});
