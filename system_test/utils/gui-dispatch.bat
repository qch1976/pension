@echo off
rem gui-dispatch.bat - PensionGuiRun Action target (relocated to system_test\utils\ per SKILL)
rem self-contained: log + run-gui.bat (job.txt driven), no nested-quote issues
setlocal
set U=C:\Users\Administrator\Desktop\Wechat projects\pension\system_test\utils
echo [%DATE% %TIME%] dispatch start >> "%U%\dispatch.log"
cd /d "%U%"
set "NODE_PATH=C:\Users\Administrator\wechat-automation\node_modules"
"C:\Program Files\nodejs\node.exe" "%U%\gui-run.js" >> "%U%\dispatch.log" 2>&1
echo [%DATE% %TIME%] dispatch end code=%ERRORLEVEL% >> "%U%\dispatch.log"
endlocal
