/* system_test/common/st-case-lib.js — ST 系列（系统测试，纯函数/静态验证）公共库（testcase-structure SKILL）
 * 公共逻辑：夹具加载、common/plan 块提取、caseFile 解析、caseValidator 校验、引擎/报告封装、断言器。
 * 不依赖 wx/页面（services/calculator 纯逻辑模块，node 直跑）；被 system_test/TST-02-ST-4xxx 独立入口 require。
 * 运行环境：权威工作区 node（无需 dev box GUI）。
 */
'use strict';
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');           // 仓库根（system_test/common/ 上溯两级）
const DOCS = path.join(ROOT, 'docs', 'customer_usecases');
const caseFile = require(path.join(ROOT, 'services', 'caseFile.js'));
const caseValidator = require(path.join(ROOT, 'services', 'caseValidator.js'));

/* 读夹具 .md 全文。 */
function loadFixture(name) { return fs.readFileSync(path.join(DOCS, name), 'utf8'); }

/* 提取 common 块（第 2 行至首个 ``` 之间）文本。 */
function commonBlock(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim().indexOf('```') === 0) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

/* 解析夹具：返回 caseFile.parseCaseFile 结果（mode/fields/records/planBlocks/errors/ok...）。 */
function parseFixture(name) {
  const raw = loadFixture(name);
  return { raw, commonText: commonBlock(raw), parsed: caseFile.parseCaseFile(commonBlock(raw)) };
}

/* 校验：caseValidator.validate（对解析结果）。 */
function validateParsed(parsed, options) {
  return caseValidator.validate(parsed, options);
}

/* 简单断言器：push {name,ok,extra}，tr 输出，end() 返回 fail 数。 */
function makeChecker(tag) {
  const checks = [];
  const log = m => console.log(m);
  const ck = (n, ok, x) => { checks.push({ name: n, ok: !!ok, extra: x == null ? '' : String(x) }); log((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' :: ' + x : '')); };
  const end = () => { const fail = checks.filter(c => !c.ok).length; log('=== ' + tag + ' pass=' + (checks.length - fail) + '/' + checks.length + ' fail=' + fail + ' ==='); return fail; };
  return { checks, ck, end, log };
}

/* 把夹具 records 按 year 升序展开为年度记录数组（ST-4006/4101 引擎喂数用）。 */
function engineInputFromParsed(parsed) {
  // mapParsedToPageData -> buildInputLike 走与页面一致的输入构造
  const pageData = caseValidator.mapParsedToPageData(parsed, {});
  return caseValidator.buildInputLike(pageData);
}

module.exports = {
  ROOT, DOCS, caseFile, caseValidator,
  loadFixture, commonBlock, parseFixture, validateParsed,
  makeChecker, engineInputFromParsed
};
