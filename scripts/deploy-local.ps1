<#
  自宅 PC へのデプロイスクリプト（GitHub Actions のセルフホストランナー、または手動で実行）

  - ビルド済みのファイル（dist など）をインストール先へコピー
  - 本番用の依存パッケージをインストール
  - pm2 でサーバーを起動 / 再起動

  設定・データ（data フォルダ）はインストール先とは別の場所（既定: %USERPROFILE%\HomeInformation\data）に
  保存されるため、デプロイしても消えません。

  例: ./scripts/deploy-local.ps1 -Source . -Target C:\HomeInformation\app
#>
param(
  [string]$Source = (Resolve-Path "$PSScriptRoot\.."),
  [string]$Target = "C:\HomeInformation\app",
  [string]$DataDir = "",
  [string]$Port = "8580"
)

$ErrorActionPreference = "Stop"

if (-not $DataDir) { $DataDir = Join-Path $env:USERPROFILE "HomeInformation\data" }

Write-Host "Source : $Source"
Write-Host "Target : $Target"
Write-Host "DataDir: $DataDir"

if (-not (Test-Path (Join-Path $Source "dist\server\index.js"))) {
  throw "dist が見つかりません。先に npm run build を実行してください。"
}

New-Item -ItemType Directory -Force -Path $Target | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

# 古いビルドを置き換える
if (Test-Path (Join-Path $Target "dist")) { Remove-Item -Recurse -Force (Join-Path $Target "dist") }
Copy-Item -Recurse -Force (Join-Path $Source "dist") (Join-Path $Target "dist")
foreach ($f in @("package.json", "package-lock.json", "ecosystem.config.cjs")) {
  Copy-Item -Force (Join-Path $Source $f) (Join-Path $Target $f)
}

Push-Location $Target
try {
  npm ci --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm ci に失敗しました" }

  if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "pm2 をインストールします"
    npm install -g pm2
  }

  $env:HOME_INFO_DATA_DIR = $DataDir
  $env:HOME_INFO_PORT = $Port
  pm2 startOrReload ecosystem.config.cjs --update-env
  if ($LASTEXITCODE -ne 0) { throw "pm2 での起動に失敗しました" }
  pm2 save
}
finally {
  Pop-Location
}

Write-Host "デプロイ完了: http://localhost:$Port"
