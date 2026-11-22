// アプリアイコン（PNG）を生成する。外部ライブラリ不要（Node 標準の zlib のみ）。
// 使い方: npm run icons
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 512 基準の白いタイル（x, y, w, h, 角丸, 不透明度）
const TILES = [
  [96, 104, 148, 148, 34, 0.95],
  [268, 104, 148, 96, 30, 0.7],
  [268, 224, 148, 184, 34, 0.9],
  [96, 276, 148, 132, 34, 0.75],
];

function insideRoundRect(px, py, [x, y, w, h, r]) {
  if (px < x || py < y || px > x + w || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function render(size, inset = 0) {
  const rgb = Buffer.alloc(size * size * 3);
  const scale = (512 - inset * 2) / 512;
  const SS = 3; // スーパーサンプリング
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((x + (sx + 0.5) / SS) / size) * 512;
          const v = ((y + (sy + 0.5) / SS) / size) * 512;
          // 背景: 紫 → 水色のグラデーション
          const t = (u + v) / 1024;
          let cr = 108 + (20 - 108) * t;
          let cg = 76 + (184 - 76) * t;
          let cb = 255 + (230 - 255) * t;
          const lu = (u - inset) / scale;
          const lv = (v - inset) / scale;
          for (const tile of TILES) {
            if (insideRoundRect(lu, lv, tile)) {
              const a = tile[5];
              cr = cr * (1 - a) + 255 * a;
              cg = cg * (1 - a) + 255 * a;
              cb = cb * (1 - a) + 255 * a;
            }
          }
          r += cr;
          g += cg;
          b += cb;
        }
      }
      const i = (y * size + x) * 3;
      rgb[i] = Math.round(r / SS / SS);
      rgb[i + 1] = Math.round(g / SS / SS);
      rgb[i + 2] = Math.round(b / SS / SS);
    }
  }
  return encodePng(size, rgb);
}

// iOS は自動で角丸にするので正方形のまま。maskable 用に少し内側へ寄せる
writeFileSync(path.join(outDir, 'apple-touch-icon.png'), render(180, 24));
writeFileSync(path.join(outDir, 'icon-192.png'), render(192, 40));
writeFileSync(path.join(outDir, 'icon-512.png'), render(512, 40));
console.log('icons written to', outDir);
