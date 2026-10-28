#!/usr/bin/env node
/*
 * matrix-gate.js — phase-close completeness gate for requirement-coverage-matrix.
 *
 * BASELINE = the architect's "initial matrix" (no separate registry file).
 *   (1) REQ rows that the initial matrix assigns to developer/tester MUST be
 *       covered by a testcase owned by that role.
 *   (2) REQ rows the initial matrix does NOT assign (e.g. owner=architect, or
 *       left blank) are NOT required to have a testcase.
 *
 * The initial matrix uses the template's OWNER column directly (no separate
 * "test by" column) with values developer / tester / both / YDL. "both"
 * requires coverage from BOTH roles, so deleting one side (e.g. the tester
 * case) fails the gate. An owner="both" final row jointly represents both
 * roles. owner="YDL" denotes a manual testcase executed by the project owner
 * (type MT); it may be assigned as late as the test phase even when the
 * architect left the requirement unassigned at specification time.
 *
 * Usage:
 *   node matrix-gate.js check <spec.md> [report.txt]
 *
 * Legacy: if the spec has no architect initial matrix (closed phase-1 style),
 * only final-matrix integrity checks run and coverage-completeness is skipped
 * (with a note). Exits 0 = pass, 1 = fail. Zero dependencies.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const TST_RE = /TST-(\d{2})-(UT|CT|ST|GT|MT)-(\d{4})/;
const REQ_TOKEN_RE = /REQ-(\d{2})-([A-Z]+)-(\d{3})((?:[~,]\d{3})*)/g;
// YDL = project owner manual tester. MT = Manual Test (executed by project owner).
const VALID_OWNERS = new Set(['developer', 'tester', 'both', 'ydl', 'null']);
// owner='null' (the literal string, case-insensitive) marks a requirement that does NOT
// require testcase coverage: it skips scope check and contributes no coverage role.
// tester scope narrowed 2026-10-14 from 4000~9999 to 4000~8999 to reserve
// 9000~9999 for owner=YDL manual testcases (MT).
const SCOPE = { architect: [0, 999], developer: [1000, 3999], tester: [4000, 8999], ydl: [9000, 9999] };
// owner=both jointly represents both sides and is exempt from a single scope.
// owner='null' yields no coverage role (requirement needs no testcase coverage).
const rolesOfOwner = (owner) => (owner === 'both' ? ['developer', 'tester'] : (owner === 'null' ? [] : [owner]));

const readLines = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').split('\n');
function splitRow(line) {
  const parts = line.split('|'); parts.pop(); parts.shift();
  return parts.map((s) => s.trim());
}
const isSeparator = (cells) => cells.every((c) => /^:?-{2,}:?$/.test(c));

/* All pipe tables under a heading matching headerRe, up to the next heading of
 * equal/higher level. Returns {header:cells[], rows:cell[][]}. */
function tableUnderHeading(lines, headerRe) {
  let start = -1;
  for (let i = 0; i < lines.length; i++)
    if (/^#{1,6}\s/.test(lines[i]) && headerRe.test(lines[i])) { start = i; break; }
  if (start < 0) return null;
  const headLevel = (lines[start].match(/^#+/) || [''])[0].length;
  let header = null;
  const rows = [];
  for (let i = start + 1; i < lines.length; i++) {
    const hm = lines[i].match(/^(#+)\s/);
    if (hm && hm[1].length <= headLevel) break;
    if (!lines[i].includes('|')) continue;
    const cells = splitRow(lines[i]);
    if (!cells.length || isSeparator(cells)) continue;
    if (!header) header = cells; else rows.push(cells);
  }
  return { header, rows };
}

function extractReqs(cell) {
  const out = new Set();
  let m;
  REQ_TOKEN_RE.lastIndex = 0;
  while ((m = REQ_TOKEN_RE.exec(cell))) {
    const [, ph, fn, first, suffix] = m;
    const prefix = `REQ-${ph}-${fn}-`;
    const nums = [+first];
    for (const part of suffix.match(/[~,]\d{3}/g) || []) {
      const val = +part.slice(1);
      if (part[0] === '~') for (let n = nums[nums.length - 1] + 1; n <= val; n++) nums.push(n);
      else nums.push(val);
    }
    for (const n of nums) out.add(prefix + String(n).padStart(3, '0'));
  }
  return [...out];
}

function colIndex(header, re) {
  for (let i = 0; i < header.length; i++) if (re.test(header[i])) return i;
  return -1;
}

// Parse the architect initial matrix into REQ -> required roles.
function parseInitial(lines) {
  const t = tableUnderHeading(lines, /initial\s*matrix|初始矩阵|architect.*matrix/i);
  if (!t) return null;
  const reqI = colIndex(t.header, /REQ|requirement|需求/);
  const testByI = colIndex(t.header, /test\s*by|测试方|tested\s*by/);
  const ownerI = colIndex(t.header, /owner|责任/);
  if (reqI < 0) return null;
  const roleFromVal = (v) => {
    v = (v || '').toLowerCase();
    if (/\bboth\b|开发.*测试|测试.*开发/.test(v)) return ['developer', 'tester'];
    const out = [];
    if (/developer|开发/.test(v)) out.push('developer');
    if (/tester|测试(?!.*主)/.test(v)) out.push('tester');
    if (/\bydl\b|项目主|项目负责人|客户/.test(v)) out.push('ydl');
    return out;
  };
  const entries = [];
  for (const row of t.rows) {
    const reqs = extractReqs(row[reqI]);
    if (!reqs.length) continue;
    // Canonical: OWNER column. Back-compat: still accept a legacy "test by" col.
    const srcCol = ownerI >= 0 ? row[ownerI] : (testByI >= 0 ? row[testByI] : '');
    const required = new Set(roleFromVal(srcCol));
    entries.push({ reqs, required });
  }
  return entries;
}

function collectReqIndex(lines) {
  const t = tableUnderHeading(lines, /REQ\s*索引|REQ\s*index/i);
  const ids = new Set();
  if (t) for (const r of t.rows) for (const id of extractReqs(r[colIndex(t.header, /REQ|requirement|需求/)])) ids.add(id);
  return ids;
}

// Extract `script=<path>` token from the case-brief cell (9-col upgraded matrix).
const SCRIPT_TOKEN_RE = /script\s*=\s*(`?)([A-Za-z0-9_./\\()\-\u4e00-\u9fff]+)\1/;
// Recognised script roots after project-documentation migration.
const SCRIPT_ROOT_RE = /^(developer_test|system_test)\/(common|utils|customer_testcases|TST-\d{2}-(?:UT|CT|ST|GT|MT)-\d{4})(?:\/|$)/;

function parseFinal(lines) {
  const t = tableUnderHeading(lines, /Testcase\s*覆盖矩阵|Testcase\s*coverage\s*matrix/i);
  if (!t) return null;
  // Two accepted layouts:
  //  (a) standalone "script folder+name" column holding a bare repo-relative path;
  //  (b) merged "case brief and script folder+name" column with a `script=` token.
  const scriptColI = colIndex(t.header, /^\s*script\s*folder\s*\+?\s*name\s*$/i);
  const mergedI = colIndex(t.header, /case brief and/i);
  const resultI = colIndex(t.header, /result|结果/);
  const bugI = colIndex(t.header, /bug\s*ID|\bbug\b/);
  return t.rows.map((c) => {
    const briefCell = mergedI >= 0 ? (c[mergedI] || '') : (c[5] || '');
    let script = '';
    if (scriptColI >= 0) {
      const raw = (c[scriptColI] || '').trim();
      const sm = raw.match(SCRIPT_TOKEN_RE);
      if (sm) script = sm[2].trim();
      else {
        // bare path in a standalone script column: take the leading path token only
        // (strip any trailing CJK remark like "path.js（备注）"), then root/existence
        // checks below judge it. Recognise any token containing a slash or .js.
        const m2 = raw.match(/^([A-Za-z0-9_./\\-]+\.(?:js|bat|py|sh|ts))/i);
        if (m2) script = m2[1];
        else {
          // directory/collection placeholder (e.g. system_test/TST-02-GT-4000/ awaiting
          // GUI redo re-homing): accept a rooted token; root regex ((?:\/|$)) plus
          // existsSync judge it (files and dirs both valid).
          const m3 = raw.match(/^((?:developer_test|system_test)\/[A-Za-z0-9_./\\-]+)/);
          if (m3) script = m3[1];
        }
      }
    }
    if (!script) {
      const sm2 = briefCell.match(SCRIPT_TOKEN_RE);
      if (sm2) script = sm2[2].trim();
    }
    return {
      reqCell: c[0] || '', brief: c[1] || '', owner: c[2] || '',
      regression: (c[3] || '').toLowerCase(), tstCell: c[4] || '',
      caseBrief: briefCell,
      script,
      result: (c[resultI >= 0 ? resultI : 6] || '').toLowerCase(),
      bugCell: c[bugI >= 0 ? bugI : 7] || '',
      tstMatch: c[4].match(TST_RE), tst: (c[4].match(TST_RE) || [null])[0],
      reqs: extractReqs(c[0]),
    };
  });
}

function cmdCheck(specPath, reportPath) {
  const lines = readLines(specPath);
  // Script paths in the matrix are repo-root-relative. The matrix lives at
  // <root>/docs/requirement_coverage/…, so the repo root is two levels up; fall back
  // to the matrix's own dir when that structure is absent.
  const specDir = path.dirname(path.resolve(specPath));
  const repoRoot = /docs[/\\]requirement_coverage$/i.test(specDir)
    ? path.resolve(specDir, '..', '..')
    : specDir;
  const reqIndex = collectReqIndex(lines);
  const initial = parseInitial(lines);
  const finalM = parseFinal(lines);
  const errors = [], warnings = [];
  const seenTst = new Set();
  // req -> roles that actually cover it (from final matrix)
  const coverByReq = new Map();
  const addCover = (req, role) => {
    if (!coverByReq.has(req)) coverByReq.set(req, new Set());
    coverByReq.get(req).add(role);
  };

  if (!finalM) errors.push('testcase coverage matrix table not found');

  if (finalM) for (const r of finalM) {
    const loc = r.tst ? `[${r.tst}]` : `(row "${r.reqCell} | ${r.brief}")`;
    if (!r.tst) { errors.push(`${loc}: no testcase ID — blanked/placeholder row`); continue; }
    const [, , type, numStr] = r.tstMatch;
    const num = +numStr;
    if (seenTst.has(r.tst)) errors.push(`${r.tst}: duplicate row`);
    seenTst.add(r.tst);
    const ownerLC = (r.owner || '').trim().toLowerCase();
    if (!VALID_OWNERS.has(ownerLC)) errors.push(`${r.tst}: owner missing/invalid ("${r.owner}"), must be developer/tester/both/YDL/null`);
    else if (ownerLC !== 'both' && ownerLC !== 'null') {
      const [lo, hi] = SCOPE[ownerLC];
      if (num < lo || num > hi) errors.push(`${r.tst}: ${num} outside ${ownerLC} scope ${lo}~${hi}`);
    }
    if (!['UT', 'CT', 'ST', 'GT', 'MT'].includes(type)) errors.push(`${r.tst}: invalid type ${type}`);
    if (r.regression !== 'yes' && r.regression !== 'no')
      errors.push(`${r.tst}: regression not set (yes/no), got "${r.regression}"`);
    if (!r.result) errors.push(`${r.tst}: result missing`);
    else if (r.result === 'fail' && !/BUG-\d{2}-\d{4}/.test(r.bugCell))
      errors.push(`${r.tst}: FAIL requires a BUG id but none present`);
    // Bug column must hold bug ID(s) only (or '-' / blank). Any residual prose is a
    // defect — explanations live in the bug table, not the matrix (owner 2026-10-28).
    if (r.bugCell && r.bugCell.trim() !== '-') {
      const residual = r.bugCell
        .replace(/BUG-\d{2}-\d{4}/g, '')
        .replace(/[,，;；、\s]/g, '');
      if (residual)
        errors.push(`${r.tst}: bug cell must contain bug ID(s) only (extra text found) — put the explanation in the bug table`);
    }
    // script folder+name gate. MT (owner=YDL manual) has no script and is exempt.
    // A `script=` token, when present, must point at the testcase's **independent
    // entry script** under a recognised migrated root; absence of any script token
    // on a scripted (UT/CT/ST/GT) row is a warning, not an error (back-compat
    // during backfill).
    if (type === 'MT') {
      if (r.script && !/manual|无脚本|手工/i.test(r.caseBrief))
        warnings.push(`${r.tst}: MT row has script token (${r.script}) — manual cases normally have none`);
    } else if (r.script) {
      if (!SCRIPT_ROOT_RE.test(r.script))
        errors.push(`${r.tst}: script path "${r.script}" not under developer_test/ or system_test/ migrated root`);
      else if (!fs.existsSync(path.resolve(repoRoot, r.script)))
        errors.push(`${r.tst}: script path "${r.script}" does not exist`);
      else {
        // testcase ID ↔ script path correspondence: the script's folder name (the
        // first TST-xx-TYPE-nnnn component in the path) must match the testcase ID
        // in the testcase ID column. Scripts under common/utils/customer_testcases
        // are shared and exempt from per-ID folder matching.
        // Historical one-script-multi-testcase rows (pre-2026-10-22 iron rule):
        // if the script's folder name matches a different TST ID, it's a known
        // historical pattern — warning only, not an error. New testcase rows
        // created after the iron rule must comply with independent entry.
        const folderM = r.script.match(/(TST-\d{2}-(?:UT|CT|ST|GT|MT)-\d{4})/);
        if (folderM && folderM[1] !== r.tst)
          warnings.push(`${r.tst}: script path folder "${folderM[1]}" does not match testcase ID "${r.tst}" (historical one-script-multi-testcase; must be same-named folder or common/utils/customer_testcases for new cases)`);
      }
    } else {
      // Owner ruling 2026-10-28: the test-script location must never be blank on a
      // scripted (UT/CT/ST/GT) row — this is an ERROR, not a backfill warning.
      // Manual verification belongs to an MT row (which is exempt above).
      errors.push(`${r.tst}: script folder+name missing — every non-MT row must record the test script location`);
    }
    if (!r.reqs.length) warnings.push(`${r.tst}: no requirement mapping`);
    for (const req of r.reqs) {
      for (const role of rolesOfOwner(ownerLC || r.owner)) addCover(req, role);
      if (reqIndex.size && !reqIndex.has(req)) errors.push(`${r.tst}: maps to ${req} not in REQ index`);
    }
  }

  // Coverage completeness against the architect initial matrix only.
  let requiredCount = 0;
  if (initial) {
    for (const { reqs, required } of initial) {
      for (const req of reqs) {
        if (!required.size) continue;
        requiredCount++;
        const got = coverByReq.get(req) || new Set();
        for (const role of required)
          if (!got.has(role))
            errors.push(`${req}: requires ${role} testcase (initial owner=${[...required].join('+')}) but none covers it`);
      }
    }
  } else {
    warnings.push('architect initial matrix not present (closed phase-1) — coverage-completeness skipped; integrity checks only');
  }

  const pass = errors.length === 0;
  const report = [
    `MATRIX GATE: ${pass ? 'PASS' : 'FAIL'}  ${new Date().toISOString()}`,
    `spec (baseline)=${specPath}`,
    `REQ index=${reqIndex.size}  final rows=${finalM ? finalM.length : 0}  unique TST=${seenTst.size}` +
      (initial ? `  REQ requiring cases=${requiredCount}` : '  initial matrix=absent'),
  ];
  if (errors.length) { report.push('', `ERRORS (${errors.length}):`); errors.forEach((e) => report.push('  ✗ ' + e)); }
  if (warnings.length) { report.push('', `WARNINGS (${warnings.length}):`); warnings.forEach((w) => report.push('  ! ' + w)); }
  const text = report.join('\n') + '\n';
  if (reportPath) fs.writeFileSync(reportPath, text);
  process.stdout.write(text);
  process.exit(pass ? 0 : 1);
}

const [, , cmd, a, b] = process.argv;
if (cmd === 'check') cmdCheck(a, b);
else { console.error('usage: matrix-gate.js check <spec.md> [report.txt]'); process.exit(2); }
