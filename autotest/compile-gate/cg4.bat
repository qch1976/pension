@echo off
setlocal
set "CLI="
for /d %%D in ("C:\Program Files (x86)\Tencent\*") do @if exist "%%~fD\cli.bat" set "CLI=%%~fD\cli.bat"
if not defined CLI (echo CLI_NOT_FOUND_UNDER_TENCENT & exit /b 9009)
set "PROJ=%~dp0..\.."
set "LOGDIR=%~dp0logs"
"%CLI%" preview --project "%PROJ%" > "%LOGDIR%\tester-compile-gate4.log" 2>&1
echo EXITCODE=%ERRORLEVEL%> "%LOGDIR%\tester-compile-gate4.exit"
