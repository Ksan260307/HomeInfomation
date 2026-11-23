/**
 * お店の名前を整える（トクバイのページ名に付く「〜のチラシ」「〜の新商品・クーポン」などを取り除く）
 *   例: 'ローソン 公園南矢田三丁目店の新商品・クーポン' → 'ローソン 公園南矢田三丁目店'
 */
export function cleanStoreName(raw: string): string {
  return raw
    .replace(/\s*[|｜].*$/, '')
    .replace(/の(チラシ|新商品|商品|お買い得|特売|セール|クーポン|店舗情報).*$/, '')
    .trim();
}

/**
 * お店ボタン用の短い名前。チェーン名（最初の空白まで）だけで区別できるならそれを使い、
 * 同じチェーンが複数あるときは支店名まで出す。
 *   例: ['万代 苅田店', 'ロピア ららぽーと堺店'] → ['万代', 'ロピア']
 *       ['万代 苅田店', '万代 矢田店']           → ['万代 苅田店', '万代 矢田店']
 */
export function shortStoreNames(names: string[]): string[] {
  const full = names.map(cleanStoreName);
  const chain = full.map((n) => n.split(/[\s\u3000]+/)[0] || n);
  return full.map((n, i) => (chain.filter((c) => c === chain[i]).length === 1 ? chain[i] : n));
}
