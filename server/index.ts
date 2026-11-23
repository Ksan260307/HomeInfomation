import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { createApp, lanUrls } from './app';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.HOME_INFO_PORT ?? 8580);
const host = process.env.HOST ?? '0.0.0.0';
// 設定・データの保存先（PC ローカル）。既定はカレントディレクトリの data/
const dataDir = path.resolve(process.env.HOME_INFO_DATA_DIR ?? path.join(process.cwd(), 'data'));
// ビルド後は dist/server/index.js から見た dist/web を配信する
const webDir = [path.resolve(here, '../web'), path.resolve(process.cwd(), 'dist/web')].find((d) => existsSync(d));

const { app } = createApp({ dataDir, webDir, version: process.env.npm_package_version });

const server = app.listen(port, host, async () => {
  const urls = lanUrls(port);
  console.log('');
  console.log('  🏠 Home Information サーバーを起動しました');
  console.log(`  ・データ保存先 : ${dataDir}`);
  console.log(`  ・この PC      : http://localhost:${port}`);
  for (const u of urls) console.log(`  ・iPad / スマホ: ${u}`);
  if (urls[0]) console.log(`  ・スマホのリモコン: ${urls[0]}/remote`);
  if (!webDir) console.log('  ※ フロントエンドは未ビルドです（開発時は http://localhost:5173 を開いてください）');
  if (urls[0] && webDir) {
    console.log('\n  iPad のカメラで読み取って開けます:');
    console.log(await QRCode.toString(urls[0], { type: 'terminal', small: true }));
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ❌ ポート ${port} は他のアプリが使用中です。環境変数 HOME_INFO_PORT で別の番号を指定してください（例: HOME_INFO_PORT=8581）\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
