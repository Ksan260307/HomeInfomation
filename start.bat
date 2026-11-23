@echo off
rem Home Information - double-click to start the server.
rem (Japanese messages are printed by scripts\start.mjs because cmd cannot parse UTF-8 batch files reliably.)
title Home Information
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js is not installed.
  echo Please install the LTS version from https://nodejs.org/ja and run this file again.
  echo.
  pause
  exit /b 1
)
node scripts\start.mjs
pause
