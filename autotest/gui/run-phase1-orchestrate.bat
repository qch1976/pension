@echo off
rem ============================================================
rem D9 Phase-1 GUI regression - human one-click (run in RDP session 2).
rem Each of the 9 scenarios spawns a FRESH cli auto on its own port
rem (61001+i), never reuses a connection, never uses legacy port 9561.
rem ============================================================
set "NODE_PATH=C:\Users\Administrator\wechat-automation\node_modules"
cd /d "%~dp0..\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0phase1-orchestrate.ps1"
echo.
echo ===== Orchestration finished. See autotest\output\phase1-gui\orchestrate.log =====
pause
