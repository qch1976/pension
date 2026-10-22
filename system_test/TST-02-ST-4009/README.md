# TST-02-ST-4009

> testcase folder（依 project-documentation SKILL：每 testcase 独立 folder + logs/）。
> 对应 Requirement：REQ-02-NFR-003

## 验证逻辑
分享取消/缺失/存盘失败均安静降级、报告仍落盘；无独立 ST 脚本，验证逻辑散落/手工，待 GUI redo 沉淀

## 脚本状态
**独立入口已沉淀并跑通**：`system_test/TST-02-ST-4009/st4009-share-degrade.js`（testcase-structure SKILL，含 case-specific input + expect 断言，公共逻辑 require `system_test/common/st-case-lib.js`）。C-8 按口径 (a) 凭验证逻辑新写、node 直跑通过（exit=0）。matrix script 列已回填。
## logs/
本 testcase 运行证据/日志落 `logs/`（.gitkeep 占位）。
