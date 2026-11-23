// start.bat から呼ばれる起動スクリプト（Node 標準機能のみで動く）
//   1. 初回・更新時はパッケージを自動インストール
//   2. ソースが更新されていれば自動でビルド
//   3. サーバーを起動（iPad 用の URL と QR コードを表示）
// ※ cmd はバッチファイル内の日本語（UTF-8）を正しく扱えないため、処理と表示はこちらで行う
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => path.join(root, ...s);
const mtime = (f) => (existsSync(f) ? statSync(f).mtimeMs : 0);
const STAMP = p('node_modules', '.home-info-installed');

function newest(target) {
  if (!existsSync(target)) return 0;
  const st = statSync(target);
  if (!st.isDirectory()) return st.mtimeMs;
  let max = 0;
  for (const name of readdirSync(target)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    max = Math.max(max, newest(path.join(target, name)));
  }
  return max;
}

/** パッケージのインストールが必要か */
export function needsInstall() {
  const required = ['express', 'vite', 'react'].every((name) => existsSync(p('node_modules', name, 'package.json')));
  if (!required) return true;
  if (!existsSync(STAMP)) {
    // 手動で npm install 済みなら、今の状態を正として記録
    writeFileSync(STAMP, new Date().toISOString());
    return false;
  }
  // git pull などで package-lock.json が更新されていれば入れ直す
  return mtime(p('package-lock.json')) > mtime(STAMP) + 2000;
}

/** ビルドが必要か（未ビルド、またはソースの方が新しい） */
export function needsBuild() {
  const built = Math.min(mtime(p('dist', 'server', 'index.js')), mtime(p('dist', 'web', 'index.html')));
  if (!built) return true;
  const sources = ['src', 'server', 'shared', 'public', 'index.html', 'package.json', 'vite.config.ts'].map((s) => newest(p(s)));
  return Math.max(...sources) > built;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error('\n[エラー] セットアップに失敗しました。上のメッセージを確認してください。');
    process.exit(1);
  }
}

function main() {
  console.log('🏠 Home Information を起動します\n');

  if (needsInstall()) {
    console.log('📦 パッケージをインストールしています（初回は数分かかります）...');
    run('npm', ['ci', '--no-audit', '--no-fund']);
    writeFileSync(STAMP, new Date().toISOString());
  }

  if (needsBuild()) {
    console.log('🔨 アプリをビルドしています...');
    run('npm', ['run', 'build']);
  }

  process.env.HOME_INFO_PORT ??= '8580';
  process.env.npm_package_version ??= JSON.parse(readFileSync(p('package.json'), 'utf8')).version;
  console.log('\n※ このウィンドウを閉じるとサーバーが停止します（最小化しておいてください）。');
  const r = spawnSync(process.execPath, [p('dist', 'server', 'index.js')], { cwd: root, stdio: 'inherit', env: process.env });
  console.log('\nサーバーが停止しました。');
  process.exit(r.status ?? 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
