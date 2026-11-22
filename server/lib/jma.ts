import type { WarningItem } from '../../shared/types';

/**
 * 気象庁 防災気象情報（2026年5月以降の新体系 = r8）の警報・注意報コード。
 * https://www.jma.go.jp/bosai/warning/data/r8/{府県予報区コード}.json
 */
export const WARNING_CODES: Record<string, { name: string; level: number }> = {
  '33': { name: 'レベル5大雨特別警報', level: 50 },
  '43': { name: 'レベル4大雨危険警報', level: 40 },
  '03': { name: 'レベル3大雨警報', level: 30 },
  '10': { name: 'レベル2大雨注意報', level: 20 },
  '39': { name: 'レベル5土砂災害特別警報', level: 50 },
  '49': { name: 'レベル4土砂災害危険警報', level: 40 },
  '09': { name: 'レベル3土砂災害警報', level: 30 },
  '29': { name: 'レベル2土砂災害注意報', level: 20 },
  '38': { name: 'レベル5高潮特別警報', level: 50 },
  '48': { name: 'レベル4高潮危険警報', level: 40 },
  '08': { name: 'レベル3高潮警報', level: 30 },
  '19': { name: 'レベル2高潮注意報', level: 20 },
  '35': { name: '暴風特別警報', level: 50 },
  '05': { name: '暴風警報', level: 30 },
  '15': { name: '強風注意報', level: 20 },
  '32': { name: '暴風雪特別警報', level: 50 },
  '02': { name: '暴風雪警報', level: 30 },
  '13': { name: '風雪注意報', level: 20 },
  '36': { name: '大雪特別警報', level: 50 },
  '06': { name: '大雪警報', level: 30 },
  '12': { name: '大雪注意報', level: 20 },
  '37': { name: '波浪特別警報', level: 50 },
  '07': { name: '波浪警報', level: 30 },
  '16': { name: '波浪注意報', level: 20 },
  '14': { name: '雷注意報', level: 20 },
  '17': { name: '融雪注意報', level: 20 },
  '20': { name: '濃霧注意報', level: 20 },
  '21': { name: '乾燥注意報', level: 20 },
  '22': { name: 'なだれ注意報', level: 20 },
  '23': { name: '低温注意報', level: 20 },
  '24': { name: '霜注意報', level: 20 },
  '25': { name: '着氷注意報', level: 20 },
  '26': { name: '着雪注意報', level: 20 },
};

const ACTIVE = new Set(['発表', '継続']);

interface R8Kind {
  code?: string;
  status?: string;
}
interface R8Report {
  reportDatetime?: string;
  headlineText?: string;
  warning?: Record<string, { areaCode: string; kinds?: R8Kind[] }[] | undefined>;
}

export interface ParsedWarnings {
  reportDatetime: string | null;
  headline: string;
  items: WarningItem[];
}

/** 指定した市区町村（class20）または一次細分区域の現在有効な警報・注意報を取り出す */
export function parseWarnings(data: unknown, areaCode: string): ParsedWarnings {
  const reports = (Array.isArray(data) ? data : [data]) as R8Report[];
  const sorted = [...reports].sort((a, b) => Date.parse(b.reportDatetime ?? '') - Date.parse(a.reportDatetime ?? ''));
  for (const report of sorted) {
    const groups = Object.values(report.warning ?? {}).flatMap((g) => g ?? []);
    const area = groups.find((g) => g.areaCode === areaCode);
    if (!area) continue;
    const items: WarningItem[] = [];
    for (const kind of area.kinds ?? []) {
      if (!kind.code || !kind.status || !ACTIVE.has(kind.status)) continue;
      const def = WARNING_CODES[kind.code];
      items.push({
        code: kind.code,
        name: def?.name ?? `警報・注意報(${kind.code})`,
        level: def?.level ?? 20,
        status: kind.status,
      });
    }
    items.sort((a, b) => b.level - a.level);
    return { reportDatetime: report.reportDatetime ?? null, headline: report.headlineText ?? '', items };
  }
  return { reportDatetime: null, headline: '', items: [] };
}

interface AreaJson {
  offices: Record<string, { name: string; children?: string[] }>;
  class10s: Record<string, { name: string; parent: string; children?: string[] }>;
  class15s: Record<string, { name: string; parent: string; children?: string[] }>;
  class20s: Record<string, { name: string; parent: string }>;
}

export interface AreaList {
  offices: { code: string; name: string }[];
  cities: Record<string, { code: string; name: string }[]>;
}

/** area.json から「府県予報区 → 市区町村」の一覧を作る */
export function buildAreaList(json: unknown): AreaList {
  const a = json as AreaJson;
  const offices = Object.entries(a.offices).map(([code, v]) => ({ code, name: v.name }));
  const cities: AreaList['cities'] = {};
  for (const [code, c20] of Object.entries(a.class20s)) {
    const c15 = a.class15s[c20.parent];
    const c10 = c15 ? a.class10s[c15.parent] : undefined;
    const office = c10?.parent;
    if (!office) continue;
    (cities[office] ??= []).push({ code, name: c20.name });
  }
  for (const list of Object.values(cities)) list.sort((x, y) => x.code.localeCompare(y.code));
  return { offices, cities };
}
