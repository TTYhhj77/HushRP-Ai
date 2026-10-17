@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
if not defined PORT set "PORT=3000"
set "HUSHRP_PORT=%PORT%"

:menu
cls
echo ====================================================================
echo                     * HushRP Launcher *
echo   Lightweight, Self-Hostable AI Roleplay Web App (Zero Dependencies)
echo ====================================================================
echo.
echo  [1] LOCAL MODE (PC Only)
echo      - URL: http://127.0.0.1:%HUSHRP_PORT%
echo      - Purpose: Single-player on this computer; maximum privacy.
echo      - Isolation: Loopback only; other devices cannot connect.
echo.
echo  [2] HOME WI-FI / LAN MODE (Mobile and Tablet on Same Network)
echo      - URL: http://[Computer-IP]:%HUSHRP_PORT%
echo      - Purpose: Chat from mobile or tablet over your home Wi-Fi.
echo      - Security: LAN Guard automatically rejects any public or remote IP.
echo.
echo  [3] VPS / CLOUD MODE (Production Server Behind Reverse Proxy)
echo      - URL: http://127.0.0.1:%HUSHRP_PORT% (Forward via Nginx / Caddy HTTPS)
echo      - Purpose: Self-hosting on a remote server with custom domain.
echo      - Security: Automatically disables browser keys for server safety.
echo.
echo  ------------------------------------------------------------------
echo  [4] EDIT SETTINGS (Configure .env / API keys)
echo  [5] RUN TESTS (Execute test suite / npm test)
echo  [6] EXIT
echo ====================================================================
echo.
choice /C 123456 /N /M "Select a mode [1-6]: "
if errorlevel 6 goto end
if errorlevel 5 goto tests
if errorlevel 4 goto editsettings
if errorlevel 3 goto vps
if errorlevel 2 goto lan
if errorlevel 1 goto local
goto menu

:setup
if not exist .env (
  copy .env.example .env >nul
  echo [Notice] Created .env from template. Configure AI_API_KEY there for live AI.
)
if not exist data mkdir data
if not exist data\uploads mkdir data\uploads
if not exist data\characters.json echo []>data\characters.json
exit /b 0

:local
call :setup
set "HOST=127.0.0.1"
set "LAN_ONLY=false"
set "RUNTIME_MODE=local"
set "PORT=%HUSHRP_PORT%"
cls
echo ====================================================================
echo   [1] LOCAL MODE: Running on this PC only (127.0.0.1)
echo ====================================================================
echo   * Access URL: http://127.0.0.1:%PORT%
echo   * Security: Loopback only; other network devices cannot connect.
echo   * To stop: Press Ctrl+C in this terminal window.
echo ====================================================================
echo.
node server.js
pause
goto menu

:lan
call :setup
set "HOST=0.0.0.0"
set "PORT=%HUSHRP_PORT%"
set "LAN_ONLY=true"
set "RUNTIME_MODE=lan"
cls
echo ====================================================================
echo   [2] HOME WI-FI / LAN MODE: Accessible from devices on same Wi-Fi
echo ====================================================================
echo   * How to connect from your phone or tablet:
echo     1. Connect your mobile device to the same Wi-Fi network as this PC.
echo     2. Open your mobile browser (Safari, Chrome, etc.) and visit:
echo.
for /f "delims=" %%I in ('node -e "console.log(require('./server').listPrivateIPv4().join(' '))"') do set "LAN_IPS=%%I"
if defined LAN_IPS (
  for %%I in (%LAN_IPS%) do echo        * http://%%I:%PORT%
) else (
  echo        (No private IPv4 found. Please ensure this PC is connected to Wi-Fi or Ethernet)
)
echo.
echo   * Security (LAN Guard):
echo     - Only private home network addresses are permitted.
echo     - Public internet traffic is rejected immediately.
echo     - No router port-forwarding required or recommended.
echo   * Windows Firewall: Allow Node.js on Private networks only.
echo   * To stop: Press Ctrl+C in this terminal window.
echo ====================================================================
echo.
set "HUSHRP_PORT=%PORT%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process PowerShell.exe -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0firewall-private-lan.ps1""' -Wait -PassThru | ForEach-Object { exit $_.ExitCode }"
if errorlevel 1 echo [Note] Firewall rule was not created automatically. If mobile cannot connect, allow Node.js on Private networks in Windows Firewall.
echo.
node server.js
pause
goto menu

:vps
call :setup
set "HOST=127.0.0.1"
set "LAN_ONLY=false"
set "RUNTIME_MODE=vps"
set "PORT=%HUSHRP_PORT%"
cls
echo ====================================================================
echo   [3] VPS / CLOUD MODE: Production Server (Reverse Proxy)
echo ====================================================================
echo   * Internal loopback: http://127.0.0.1:%PORT%
echo   * Security Requirements:
echo     - Place a reverse proxy (e.g., Caddy, Nginx, Cloudflare Tunnel)
echo       with HTTPS in front of this local port.
echo     - Do not expose plain HTTP directly to the public internet.
echo     - Browser API keys are automatically disabled in VPS mode
echo       (server AI_API_KEY in .env will be used).
echo   * To stop: Press Ctrl+C in this terminal window.
echo ====================================================================
echo.
node server.js
pause
goto menu

:editsettings
call :setup
if not defined EDITOR set "EDITOR=notepad.exe"
start "" "%EDITOR%" ".env"
echo.
echo Opening .env with %EDITOR%...
echo Save changes, close the editor, and restart the app for settings to take effect.
echo.
pause
goto menu

:tests
call :setup
echo.
echo Running HushRP test suite (npm test)...
echo.
npm test
pause
goto menu

:end
endlocal
