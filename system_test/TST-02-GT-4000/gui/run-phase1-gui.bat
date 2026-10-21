@echo off
rem D9 Phase-1 GUI regression runner (runs in Administrator interactive RDP session)
set "NODE_PATH=C:\Users\Administrator\wechat-automation\node_modules"
set "SKIP_ENSURE=1"
cd /d "C:\Users\Administrator\Desktop\Wechat projects\pension"
if not exist system_test\output\phase1-gui mkdir system_test\output\phase1-gui
node system_test\TST-02-GT-4000\gui\phase1-gui-regression.js > system_test\output\phase1-gui\run.log 2>&1
echo DONE_EXITCODE=%ERRORLEVEL% >> system_test\output\phase1-gui\run.log
