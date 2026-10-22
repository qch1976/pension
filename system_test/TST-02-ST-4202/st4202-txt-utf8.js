/* ST-4202 — 输出纯文本 .txt/UTF-8、不含 PDF 独立入口（testcase-structure SKILL）
 * input: reportExport.buildBasicReport/buildCompareReport 产物 + fileStore.writeOutput 路径/编码
 * expect: ① 报告为字符串纯文本、含「编码：UTF-8 纯文本」声明 ② 文件名 .txt、encoding=utf8 ③ 不含 PDF/二进制标记
 * 公共: system_test/common/st-case-lib.js；运行: node st4202-txt-utf8.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const E = require('../../calculator/pensionEngine.js');
const reportExport = require('../../services/reportExport.js');
const { ck, end } = L.makeChecker('ST-4202');

// 生成 basic 报告文本
const text = L.commonBlock(L.loadFixture('My-Case.md')) + '\n# 预计退休时间: 2033-07\n# 从2026-09往后的缴费性质: 失业灵活就业\n# 预计从2026-09往后每月缴费Z值: 0.6\n';
const v = L.caseValidator.validate(L.caseFile.parseCaseFile(text), {});
const result = E.calculate(v.engineInput);
const report = reportExport.buildBasicReport(result, { generatedAt: '2026-10-22 01:02:03' });

ck('报告产物为字符串（纯文本，非 Buffer/对象）', typeof report === 'string', typeof report);
ck('报告声明「编码：UTF-8 纯文本」', /编码：UTF-8 纯文本/.test(report), report.split(/\r?\n/).slice(0, 4).join('|'));
ck('报告为 UTF-8 可编码（无非法代理对）', Buffer.from(report, 'utf8').toString('utf8') === report, 'utf8 round-trip');
ck('报告不含 PDF 魔数 %PDF', !report.includes('%PDF'), '');
ck('报告不含二进制控制符（除 \\r\\n\\t）', !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(report), '');
ck('报告非空且多行（纯文本报告体）', report.length > 100 && report.split(/\r?\n/).length > 5, 'lines=' + report.split(/\r?\n/).length);

// compare 报告同为纯文本
const CRM = require('../../calculator/compareResultModel.js');
const raw = L.loadFixture('My-Case.md');
const blocks = L.caseFile._splitBlocks(raw).slice(1);
const plans = blocks.map((b, i) => { const f = L.caseFile.parseCaseFile(b.lines.join('\n')).fields; return { id: 'plan' + (i + 1), retireYM: f.retireYM, segType: L.caseFile.mapIdentityToType(f.contributionNature), z: f.zValue, windowStartYM: '' }; });
const view = CRM.buildView(v.engineInput, plans, 0);
const cmpReport = reportExport.buildCompareReport(view, { generatedAt: '2026-10-22 01:02:03' });
ck('compare 报告同为字符串纯文本', typeof cmpReport === 'string', typeof cmpReport);
ck('compare 报告不含 PDF 魔数', !cmpReport.includes('%PDF'), '');

// fileStore.writeOutput 写 .txt/UTF-8（mock fsm 校验 filePath 后缀与 encoding）
const fileStore = require('../../services/fileStore.js');
let captured = null;
const mockFsm = {
  mkdir: o => o.success && o.success(), access: o => o.fail && o.fail({ errMsg: 'x' }),
  writeFile: o => { captured = { filePath: o.filePath, encoding: o.encoding }; o.success && o.success(); },
  stat: o => o.fail && o.fail({ errMsg: 'x' }), saveFile: o => o.success && o.success({}), readdir: o => o.success && o.success({ files: [] }), rmdir: o => o.success && o.success(), unlink: o => o.success && o.success()
};
const store = fileStore.createFileStore({ env: { USER_DATA_PATH: '/mock' } }, { getFsm: () => mockFsm, now: () => new Date(2026, 9, 22, 1, 2, 3) });
store.writeOutput('basic', report).then(() => {
  ck('writeOutput 文件名 .txt 后缀', captured && /\.txt$/.test(captured.filePath), captured && captured.filePath);
  ck('writeOutput encoding=utf8', captured && captured.encoding === 'utf8', captured && captured.encoding);
  ck('writeOutput 路径在 pension/outputs', captured && /pension[\\/]outputs/.test(captured.filePath), captured && captured.filePath);
  process.exit(end() ? 1 : 0);
}).catch(e => { console.log('FATAL ' + (e && e.message)); process.exit(2); });
