@echo off
setlocal
set "GATEDIR=%~dp0"
set "LOGDIR=%~dp0logs"
cmd /s /c ""%GATEDIR%cg-bug1921-child.bat" > "%LOGDIR%\dev-bug1921-preview.log" 2>&1"
echo EXITCODE=%ERRORLEVEL%> "%LOGDIR%\dev-bug1921-preview.exit"
