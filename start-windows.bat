@echo off
title Shift AI
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed yet.
  echo  1. Go to https://nodejs.org and install the LTS version
  echo  2. Then double-click this file again
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First-time setup -- takes a minute or two...
  call npm install
)

echo.
echo  Starting Shift AI... your browser will open in a few seconds.
echo  Keep this window open while you use the app.
echo.
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000"
call npm run dev
pause
