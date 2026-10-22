// developer_test/TST-02-UT-1009/casefile-mode-flag-check.js
// TST-02-UT-1009（REQ-02-IN-000，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：模式标志切换逻辑——mode 缺省/'basic'→basic，'compare'→compare；compare 缺共用块报错。
'use strict';
var path = require('path');
var CF = require(path.join(__dirname, '..', '..', 'services', 'caseFile.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1009');

// case-specific input
var basicText = '# 生日: 1976-09-08\n# 参加工作时间: 1995-07\n# 首次建立养老账号: 2000-11\n' +
  '# 养老保险目前交到: 2026-08\n# 个人账户金额: 100000\n# 预计退休时间: 2033-07\n' +
  '# 缴费记录\n| 年份 | 基数 | 月数 |\n| --- | --- | --- |\n| 2020 | 50000 | 12 |\n';
var compareNoCommon = '``` x ```\n# 生日: 1-1\n``` y ```\n# 生日: 2-2\n';

// expect output 断言
// 1) 缺省/非法 mode 归一为 basic
A.eq(CF.parseCaseFile(basicText).mode, 'basic', 'mode 缺省 -> basic');
A.eq(CF.parseCaseFile(basicText, 'basic').mode, 'basic', "mode='basic' -> basic");
A.eq(CF.parseCaseFile(basicText, 'anything').mode, 'basic', '非法 mode 归一 -> basic');
// 2) 'compare' 切到 compare
var cmpOk = CF.parseCaseFile('# 生日: 1976-09-08\n# 养老保险目前交到: 2026-08\n# 缴费记录\n| 年份 | 基数 | 月数 |\n| --- | --- | --- |\n| 2020 | 50000 | 12 |\n', 'compare');
A.eq(cmpOk.mode, 'compare', "mode='compare' -> compare");
// 3) compare 缺共用数据块报错（模式相关差异）
var nc = CF.parseCaseFile(compareNoCommon, 'compare');
A.ok(!nc.ok && nc.errors.some(function (e) { return /缺少共用数据块/.test(e.reason); }), 'compare 多块且无common报「缺少共用数据块」');
A.finish();
