@echo off
rem Home Information サーバーを起動します（ビルド済みの dist が必要）
rem スタートアップに登録する場合: Win+R → shell:startup → このファイルのショートカットを置く
chcp 65001 > nul
cd /d "%~dp0.."
if "%HOME_INFO_DATA_DIR%"=="" set HOME_INFO_DATA_DIR=%USERPROFILE%\HomeInformation\data
if "%HOME_INFO_PORT%"=="" set HOME_INFO_PORT=8580
if not exist dist\server\index.js (
  echo dist が見つかりません。先に npm ci と npm run build を実行してください。
  pause
  exit /b 1
)
node dist\server\index.js
pause
