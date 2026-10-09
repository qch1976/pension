@echo off
cd /d "%~dp0.."
set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" set NODE=node
for %%S in (tests\run-tests.js tests\account-subsidy-check.js tests\regression-check.js tests\round1-fixes.js tests\viewmodel-audit.js tests\viewmodel-mapping-check.js tests\wxml-expr-check.js scripts\verify.js scripts\wxml-check.js tests\shared-data-check.js tests\plan-model-check.js tests\plan-assembler-check.js tests\r-contribution-check.js tests\payback-check.js tests\roi-check.js tests\compare-result-model-check.js tests\plan-dedup-check.js tests\file-store-check.js tests\case-file-check.js tests\case-validator-check.js tests\report-export-check.js tests\report-share-check.js) do (
  echo ===== SUITE: %%S =====
  "%NODE%" %%S
  echo EXITCODE=%ERRORLEVEL%
)
echo ALL_SUITES_DONE
