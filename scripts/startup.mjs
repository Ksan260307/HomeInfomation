// Windows の自動起動（スタートアップ）への登録・解除
//   node scripts/startup.mjs register   … サインイン時に start.bat を最小化で起動
//   node scripts/startup.mjs unregister … 登録を解除
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'start.bat');
const mode = process.argv[2];

// 日本語を含むパスでも壊れないよう、値は環境変数で PowerShell に渡す
const ps = (script) =>
  spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    env: { ...process.env, HI_TARGET: target, HI_ROOT: root },
    encoding: 'utf8',
  });

const LNK = "(Join-Path ([Environment]::GetFolderPath('Startup')) 'Home Information.lnk')";

if (mode === 'register') {
  const r = ps(
    `$lnk = ${LNK}; $s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk); ` +
      `$s.TargetPath = $env:HI_TARGET; $s.WorkingDirectory = $env:HI_ROOT; $s.WindowStyle = 7; $s.Save(); Write-Output $lnk`,
  );
  if (r.status === 0) {
    console.log(`✅ 自動起動に登録しました\n   ${r.stdout.trim()}`);
    console.log('   次回 PC にサインインしたときから、最小化した状態で自動的に起動します。');
    console.log('   解除するには scripts\\unregister-startup.bat を実行してください。');
  } else {
    console.error('❌ 登録に失敗しました。\n', r.stderr);
    process.exit(1);
  }
} else if (mode === 'unregister') {
  const r = ps(`$lnk = ${LNK}; if (Test-Path $lnk) { Remove-Item $lnk; exit 0 } else { exit 3 }`);
  if (r.status === 0) console.log('✅ 自動起動を解除しました。');
  else if (r.status === 3) console.log('自動起動は登録されていません。');
  else {
    console.error('❌ 解除に失敗しました。\n', r.stderr);
    process.exit(1);
  }
} else {
  console.error('usage: node scripts/startup.mjs register|unregister');
  process.exit(2);
}
