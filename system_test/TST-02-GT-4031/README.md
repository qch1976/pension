# TST-02-GT-4031

> testcase folder（依 project-documentation SKILL：每 testcase 独立 folder + logs/）。
> 对应 Requirement：REQ-02-IN-003, REQ-02-VAL-004, REQ-02-FMT-000

## 验证逻辑
基线 0bc2775；脚本 gt4031-five-col-parse.js（常驻口40215，真实 onChooseCaseFile 文件导入+只读回读）。12/12 PASS（TS=20261014-182115）：F1 My 27段；F2 首段 2000-11~2000-12 enterprise/baseMonthly3071（旧缺省起始月1摆错月已纠正）；F3 My 全 enterprise；F4 fileErrors0/builtOk/rate0.015；F5 MyWife 23段；F6 关键跨度 2003-09~12/2005-01~07/2006-04~12；F7 Wife 全 enterprise、女性/女工人、rate0.015、bal481459；F8 Wife 两卡（产品法定退休月2034-11，z0.6/z3）真实结果页 ready/2列 P月 8465.41/11179.12 与独立重算一致；F9 临时5列「灵活」→flexible(2010-03~04)、「单位」→enterprise；F10 旧3列 startMonth缺省1/type缺省enterprise（向后兼容）；F11 非法身份「外包」逐行拦截；F12 起始月13(非1~12)逐行拦截。证据 json/gt4031-20261014-182115.summary.json、screenshots/gt4031-20261014-182115.png；脚本未入库（GUI redo dev box 侧产物），待归位

## 脚本状态
**脚本未入库**：本 testcase 的 GUI redo 单脚本在 dev box (39.106.208.34) 与权威工作区均不存在（C-7 实测，仅证据 json 留存于 autotest/output/）。matrix script 列留空。待补写并跑通后归位。

## logs/
本 testcase 运行证据/日志落 `logs/`（.gitkeep 占位）。
