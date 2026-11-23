@echo off
rem Register start.bat to run automatically when you sign in to Windows.
cd /d "%~dp0.."
node scripts\startup.mjs register
pause
