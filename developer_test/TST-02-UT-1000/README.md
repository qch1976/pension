# TST-02-UT-1000 — 存储封装（REQ-02-STORE-000，file-store-check.js）

file-store-check.js 一脚本覆盖存储封装系列 TST-02-UT-1000~1004（STORE-000~004）：

| TST | 内容 |
|---|---|
| TST-02-UT-1000 | 内存 fsm 验证 mkdir / 根取 USER_DATA_PATH（REQ-02-STORE-000） |
| TST-02-UT-1001 | copyFile/writeFile 持久化、read+write 兜底（STORE-001） |
| TST-02-UT-1002 | 存储封装不影响既有 storage（NFR-004） |
| TST-02-UT-1003 | listStoredFiles/cleanList 跳过越界（STORE-003） |
| TST-02-UT-1004 | 封装仅本地文件 API、与 storage key 隔离（STORE-004/NFR-000） |
