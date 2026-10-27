# 测试报告 · task-78 · BUG-02-0008 修复独立 GUI 验收

| 项 | 内容 |
|---|---|
| 任务 | p-mu45ws9mfajyky-task-78（tester worker4 / Senior Wechat Tester YDL） |
| 被测缺陷 | BUG-02-0008：文件导入后未触碰默认方案卡 retireYM 残留演示出生年陈旧值 2026-01，不随真实 ctx 刷新 |
| 上游修复 | developer task-77，commit 6e8ea72（architect task-76 方向一） |
| 验收基线 | origin/master = **6e8ea72**（dev box fetch + reset --hard 对齐，HEAD 实测一致） |
| 测试类型 | 独立 GUI 验收（miniprogram-automator）+ UT 独立复跑 + 矩阵回填 |
| 结论 | **PASS · 33/33**，建议将 BUG-02-0008 置 **verified** |

---

## 1. 缺陷与修复（步骤—现象—根因—修法—回归点）

- **步骤/现象**：entry 页不填任何信息 → 直接进"方案比较" → 文件输入导入完整 My-Case.md，两张用户从未触碰的默认方案卡 `retireYM` 停留在演示默认出生年（1965-10）推出的 **2026-01**，不随真实出生年（1973-07，法定应为 **2035-09**）刷新，且已 persist 到 `pension_plans_v1`；导入即非法（退休月早于历史末月 2026-08），阻断"开始比较"。
- **根因（architect 复核，tester 认可）**：plan-list 的 ctx observer 判定为 `if(!retireTouched && !retireYM)`，把"系统默认值"与"用户已选值"混同——演示 ctx 下首次填入 2026-01 并 persist 后，真实 ctx 到来时因 `!retireYM` 不成立而无法重算纠正。
- **修法（方向一，6e8ea72）**：`calculator/planModel.js` 新增纯函数 `syncUnspecifiedRetire(plans,ctx)`（retireTouched=false 的卡以最新 ctx 法定退休月重算；true 原样保留；值相同不标记 changed）；`components/plan-list/plan-list.js` observer 去掉 `&& !p.retireYM`，改为对所有未手选卡统一重算；changed 才 applyPlans/persist。
- **回归点**：① 主导入两卡转 2035-09/无红错/draft 同/可比较；② MyWife 女性档不残留 2026-01；③ 手选保护；④ 脏 draft 自愈；⑤ 既有手工路径 + 三卡增删 + 结果计算不回归。

## 2. 测试环境与方法

- dev box 权威仓 `C:\Users\Administrator\Desktop\Wechat projects\pension`；微信开发者工具 + miniprogram-automator **常驻口 40215**（keeper 保活）；业务脚本只 `connect/disconnect`，**零 RDP、未杀进程、未自起 cli auto**。
- 真实文件链路：写 USER_DATA_PATH 真实文件 → mock `chooseMessageFile` → 触发产品 `onChooseCaseFile`（夹具为 `docs/customer_usecases` 下真实 My-Case.md / MyWife-Case.md）。
- 独立取值：所有期望退休月由 tester 用产品模块 `retireSchedule`/`planModel` **独立 derive**，未引用 developer/architect 回显；卡红错用 node 侧 `PM.planErrors`（卡 recheck 调用的同一纯函数）独立计算取证。
- 卡录入（z/性质/退休月）走父组件真实 `plan-list.onCardChange`（→ applyPlans/persist 产品路径）。

## 3. 验收结果：5 场景 33/33 PASS

| 场景 | 链路 | 实测关键值 | 结果 |
|---|---|---|---|
| A 主复现 | 清双 draft → entry 不填 → compare → 导入 My-Case | 两卡 retireYM=**2035-09**（非2026-01）、touched=false；storage 两卡=2035-09；无退休红错；补 z/性质后 isValidPlan=true、开始比较进 compare-result（≥2列） | PASS（12 项） |
| B MyWife | 导入 MyWife-Case（1981-07） | 导入默认 male=**2044-07** 不残留2026-01；共享区正规交互切 female/worker=**2034-11**、cadre=**2039-06**；无退休红错 | PASS（6 项） |
| C 脏 draft 自愈 | 预置两卡 2026-01/touched=false → 进 compare → 导入 | 导入前=2026-01；导入后两卡自愈=**2035-09**/false 并落 storage | PASS（3 项） |
| D 手选保护 | 手改卡1=2035-03（touched=true） | 改出生年(1974-07)后卡1仍 **2035-03**、卡2→2036-12；再导入 My-Case 后卡1仍 2035-03、卡2→2035-09 | PASS（6 项） |
| E 零回归 | 手工既有路径 + 三卡增删 + 结果计算 | 手工填出生年两卡=2035-09；新增第3卡带正确法定值；删除回 2 卡；手工建卡+补全历史两列 **P月=15045.76 / 16577.37** 有限正值 | PASS（6 项） |

证据：`system_test/TST-02-GT-4032/logs/result-GT4032-task78.json`、`run-trace.log`、截图 `GT4032-A-mycase.png` / `GT4032-B-mywife.png` / `GT4032-E-result.png`（均 automator 原生，≤3 张）。

## 4. UT 独立复跑

- 命令：`node developer_test/TST-02-UT-1037/retire-sync-ctx-check.js`
- 输出：**TST-02-UT-1037: pass=28 fail=0**（exit=0）。tester 本次真实执行，非引用 developer 回显。

## 5. 矩阵回填

- 文件 `docs/requirement_coverage/phase2-final-coverage-matrix.md`：仅新增 1 行 **TST-02-GT-4032 · PASS 33/33 · bug=BUG-02-0008 · script 指向 gt-4032-task78.js**；`git diff` 实测 1 insertion，其余行逐字节不变。

## 6. 过程问题与诚信记录（如实说明）

- **首跑 25/6**：根因是脚本侧 `plan-list.selectAllComponents('/components/plan-card/plan-card')` 在当前基础库返回 0 个实例，导致子卡方法（onRetire/onZ/setSegType）从未被调用（卡 stayed 2035-09）。经隔离探针实证为**脚本选择器/调用方式问题，非产品缺陷**；改为走父层真实 `onCardChange` 后修复。
- **E5 首版数据不完整**：手工仅填出生年、无缴费历史时，`buildValidatedInput` 返回 ok=false（"年度模式第1行：请填写年缴费基数（大于0）"），startCompare **正确拦截不跳转**——属产品正确校验、非回归。E5 改为补全真实历史后验结果计算；该拦截行为已记录。

## 7. 已知非本次回归项

- 按 Manager 在父提交 599283c 的独立核查：`developer_test/utils/assert-bug25-26.js` 直接 node 跑有 10 条输入页 UI 结构 fail，系修复前就存在的历史过期断言，与 BUG-02-0008 无关，不计入本次回归。

## 8. 结论与上线风险建议

- BUG-02-0008 修复有效：文件导入/手改共享/entry 带入等全部 ctx 变化路径下，未手选卡退休月均随最新 ctx 正确刷新，手选值受保护，历史脏 draft 可自愈，既有功能与结果计算无回归。
- **建议**：Manager 复核本 commit 后推送 origin/master，将 BUG-02-0008 置 **verified**；风险低，无数据迁移。
