@echo off
rem Start persistent cli auto in interactive session; reuse the already-open IDE.
set "NODE_PATH=C:\Users\Administrator\wechat-automation\node_modules"
cd /d "C:\Users\Administrator\Desktop\Wechat projects\pension"
if not exist autotest\output\phase1-gui mkdir autotest\output\phase1-gui
echo START_CLI_AUTO_BEGIN > autotest\output\phase1-gui\cliauto-run.log
"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" auto --project "C:\Users\Administrator\Desktop\Wechat projects\pension" --auto-port 9561 >> autotest\output\phase1-gui\cliauto-run.log 2>&1
echo CLI_AUTO_EXIT=%ERRORLEVEL% >> autotest\output\phase1-gui\cliauto-run.log
