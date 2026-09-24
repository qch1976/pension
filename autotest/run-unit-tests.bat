@echo off
cd /d "%~dp0.."
set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" set NODE=node
for %%S in (tests\run-tests.js tests\account-subsidy-check.js tests\regression-check.js tests\round1-fixes.js tests\viewmodel-audit.js tests\viewmodel-mapping-check.js tests\wxml-expr-check.js scripts\verify.js scripts\wxml-check.js) do (
  echo ===== SUITE: %%S =====
  "%NODE%" %%S
  echo EXITCODE=%ERRORLEVEL%
)
echo ALL_SUITES_DONE
