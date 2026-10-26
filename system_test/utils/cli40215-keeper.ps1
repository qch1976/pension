# cli40215-keeper.ps1 鈥?task-73 瀵归綈 PLAYBOOK 搂7/搂12 钖?wrapper
# 瀹為檯鎷夎捣閫昏緫鍦?cli40215-keeper.js锛圢ode spawn 鏁扮粍浼犲弬锛岀┖鏍煎畨鍏級銆?
# 鏈?ps1 浠呰浆璋?node锛屼繚鐣?40215 澶嶇敤棰勬锛堝揩閫熻矾寰勶紝閬垮厤涓嶅繀瑕佺殑 node 鍚姩锛夈€?
$ErrorActionPreference = 'Continue'

# 澶嶇敤棰勬锛?0215 宸?LISTEN 鐩存帴閫€鍑?0锛堜笉鍚姩 node锛屾渶蹇矾寰勶級
if (Get-NetTCPConnection -State Listen -LocalPort 40215 -ErrorAction SilentlyContinue) {
  Write-Output '40215 already LISTEN, reuse.'
  exit 0
}

# 杞皟 node keeper锛堝疄闄?spawn + 杞閫昏緫锛岃緭鍑哄伐绋嬪 runs 鐩綍锛?
$keeperJs = Join-Path $PSScriptRoot 'cli40215-keeper.js'
if (-not (Test-Path $keeperJs)) { Write-Output ("FATAL: keeper.js not found: " + $keeperJs); exit 2 }

# node 闇€鍦?PATH锛坉ev box node v24.15.0 宸茬‘璁わ級
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Output 'FATAL: node not on PATH'; exit 2 }

& node $keeperJs
exit $LASTEXITCODE

