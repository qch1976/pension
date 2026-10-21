@echo off
setlocal
set "CLI="
for /d %%D in ("C:\Program Files (x86)\Tencent\*") do @if exist "%%~fD\cli.bat" set "CLI=%%~fD\cli.bat"
if not defined CLI (echo CLI_NOT_FOUND_UNDER_TENCENT & exit /b 9009)
set "PROJ=%~dp0..\.."
echo COMPILE_GATE_START %DATE% %TIME%
"%CLI%" preview --project "%PROJ%"
echo CLI_EXITCODE=%ERRORLEVEL%
echo COMPILE_GATE_END %DATE% %TIME%
