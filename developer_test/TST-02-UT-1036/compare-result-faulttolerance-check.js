// developer_test/TST-02-UT-1036/compare-result-faulttolerance-check.js
// TST-02-UT-1036（BUG-02-0010，REQ-02-NFR-003/NFR-004，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：compare-result 坏输入不白屏容错（分段⑤：buildViewSafe {ok:false,error}、纯 buildView 仍抛、rebuild 置 ready=false+loadError）。
'use strict';
var path = require('path');
var CF = require(path.join(__dirname, '..', '..', 'services', 'caseFile.js'));
var CV = require(path.join(__dirname, '..', '..', 'services', 'caseValidator.js'));
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var CRM = require(path.join(__dirname, '..', '..', 'calculator', 'compareResultModel.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));
var FIX = require(path.join(__dirname, '..', 'common', 'case-fixture.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1036');

var myParsed = CF.parseCaseFile(FIX.loadMy(), 'compare');
var shared = V.buildSharedInput(P, D, CV.mapParsedToPageData(myParsed, {}));
var plans = [
  { id: 'a', retireYM: '2033-07', z: 0.6, segType: 'enterprise' },
  { id: 'b', retireYM: '2033-07', z: 3.0, segType: 'enterprise' }
];
// 构造坏输入：段身份为非法值（绕过双保险直接喂引擎层结构）
var badShared = JSON.parse(JSON.stringify(shared));
badShared.segments[3].type = 'not-a-type';

// buildViewSafe：坏输入返回 {ok:false,error} 不白屏
var safe = CRM.buildViewSafe(badShared, plans, 0);
A.ok(safe.ok === false && typeof safe.error === 'string' && safe.error.length > 0, 'buildViewSafe 坏输入返回 {ok:false,error}');
A.ok(/身份类型非法|校验失败/.test(safe.error), '错误信息可读且点出身份非法：' + safe.error);

// 纯 buildView：对坏输入仍抛错（保持纯函数语义，供前置预检/单测）
var pureThrew = false;
try { CRM.buildView(badShared, plans, 0); } catch (e) { pureThrew = true; }
A.ok(pureThrew, '纯 buildView 对坏输入仍抛错');

// 页面 rebuild 行为模拟（无 wx，注入最小 Page 桩取出 rebuild）
var calls = [];
var captured = null;
global.Page = function (def) { captured = def; };
delete require.cache[require.resolve(path.join(__dirname, '..', '..', 'pages', 'compare-result', 'compare-result.js'))];
require(path.join(__dirname, '..', '..', 'pages', 'compare-result', 'compare-result.js'));
A.ok(typeof captured.rebuild === 'function', 'compare-result 页面暴露 rebuild');
captured.sharedInput = badShared;
captured.plans = plans;
captured.setData = function (obj) { calls.push(obj); };
captured.rebuild(0);
var errCall = calls.filter(function (c) { return c.ready === false; })[0];
A.ok(!!errCall && /比较计算失败/.test(errCall.loadError) && /返回方案输入页核对/.test(errCall.loadError),
  'rebuild 坏输入置 ready=false 且给可读 loadError，不白屏：' + (errCall && errCall.loadError));
A.finish();
