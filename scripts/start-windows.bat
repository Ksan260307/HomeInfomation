@echo off
rem Start the server from a release zip (dist must already be built).
rem Kept for compatibility; start.bat in the project root does the same and also installs/builds when needed.
title Home Information
cd /d "%~dp0.."
if "%HOME_INFO_DATA_DIR%"=="" set "HOME_INFO_DATA_DIR=%USERPROFILE%\HomeInformation\data"
if "%HOME_INFO_PORT%"=="" set HOME_INFO_PORT=8580
if not exist dist\server\index.js (
  echo dist\server\index.js was not found. Run "npm ci" and "npm run build" first.
  pause
  exit /b 1
)
node dist\server\index.js
pause
