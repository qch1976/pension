@echo off
cd /d "%~dp0.."
set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" set NODE=node
for %%S in (developer_test\common\run-tests.js developer_test\common\account-subsidy-check.js developer_test\common\regression-check.js developer_test\common\round1-fixes.js developer_test\TST-02-CT-1015\viewmodel-audit.js developer_test\TST-02-CT-1016\viewmodel-mapping-check.js developer_test\TST-02-CT-1017\wxml-expr-check.js scripts\verify.js scripts\wxml-check.js developer_test\TST-02-UT-1028\shared-data-check.js developer_test\TST-02-UT-1030\plan-model-check.js developer_test\TST-02-UT-1030\plan-assembler-check.js developer_test\TST-02-UT-1030\r-contribution-check.js developer_test\TST-02-UT-1030\payback-check.js developer_test\TST-02-UT-1030\roi-check.js developer_test\TST-02-UT-1030\compare-result-model-check.js developer_test\TST-02-UT-1030\plan-dedup-check.js developer_test\TST-02-UT-1000\file-store-check.js developer_test\TST-02-UT-1010\case-file-check.js developer_test\TST-02-UT-1011\case-validator-check.js developer_test\TST-02-UT-1018\report-export-check.js developer_test\TST-02-UT-1021\report-share-check.js developer_test\TST-02-UT-1025\bug02-0004-0007-check.js developer_test\TST-02-UT-1032\bug02-0010-check.js) do (
  echo ===== SUITE: %%S =====
  "%NODE%" %%S
  echo EXITCODE=%ERRORLEVEL%
)
echo ALL_SUITES_DONE
