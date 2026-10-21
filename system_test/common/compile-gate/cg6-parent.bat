@echo off
setlocal
set "GATEDIR=%~dp0"
set "LOGDIR=%~dp0logs"
cmd /s /c ""%GATEDIR%cg6-child.bat" > "%LOGDIR%\tester-compile-gate6.log" 2>&1"
echo EXITCODE=%ERRORLEVEL%> "%LOGDIR%\tester-compile-gate6.exit"
