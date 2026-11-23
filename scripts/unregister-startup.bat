@echo off
rem Remove the automatic start registration.
cd /d "%~dp0.."
node scripts\startup.mjs unregister
pause
