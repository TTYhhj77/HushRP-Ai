@echo off
cd /d "%~dp0"
set HOST=127.0.0.1
if "%PORT%"=="" set PORT=3000
if not exist .env copy .env.example .env >nul
echo ====================================================================
echo   ✦ HushRP - Local Mode (PC Only / 127.0.0.1) ✦
echo ====================================================================
echo   * Browser URL: http://127.0.0.1:%PORT%
echo   * Security: Loopback only; other network devices cannot connect.
echo   * For mobile / Wi-Fi sharing, run start.cmd instead.
echo   * Configure server AI_API_KEY in .env if needed.
echo   * To stop: Press Ctrl+C in this window.
echo ====================================================================
echo.
node server.js
pause
