@echo off
REM ============================================================
REM  Service Desk — Control Room One-Click Start
REM  1) Starts the system server ONLY if it is not already running
REM  2) Opens the wallboard kiosk, one fullscreen window per monitor
REM
REM  Edit staff IDs/browser in scripts\kiosk.ps1 before running.
REM ============================================================

cd /d "%~dp0.."

REM Check quickly if the server is already up (port 3001).
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 3001); $c.Close(); exit 1 } catch { exit 0 }"

if errorlevel 1 (
  echo Server already running on port 3001. Skipping server start.
) else (
  echo Starting server...
  start "Service Desk API" cmd /k "npm start"
  timeout /t 8 /nobreak >nul
)

REM Launch the wallboard kiosk (one window per monitor).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kiosk.ps1"
