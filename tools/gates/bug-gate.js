#!/usr/bin/env node
/*
 * bug-gate.js — quality gate for the bug-fix SKILL.
 *
 * Validates a bug table (e.g. docs/bugs/Customer-Bug-List.md):
 *   1. every ticket must carry the six required sections:
 *        testcase ID / failure description / root cause analysis /
 *        fix solution description / fix verification process / bug status
 *   2. bug status must be exactly one of:
 *        open | assigned | fixed | verified | closed | cnn | fcp
 *   3. matrix linkage (when a coverage matrix is supplied):
 *        closed | cnn | fcp  (final)      -> every matrix row referencing the
 *                                            bug must record PASS
 *        open/assigned/fixed/verified     -> referencing rows must record FAIL
 *
 * Usage:
 *   node bug-gate.js check <bugTable.md> [matrix.md] [report.txt]
 * Exit code: 0 PASS, 1 FAIL.
 */
'use strict';
const fs = require('fs');

const STATUSES = ['open', 'assigned', 'fixed', 'verified', 'closed', 'cnn', 'fcp'];
const FINAL = new Set(['closed', 'cnn', 'fcp']);
const BUG_HDR_RE = /^##\s+(BUG-\d{2}-\d{4})\b.*$/;
const TST_RE = /TST-\d{2}-(?:UT|CT|ST|GT|MT)-\d{4}/g;
const BUGID_RE = /BUG-\d{2}-\d{4}/g;

// Required section -> recognisers (matched against a lower-cased header line).
const SECTIONS = [
  { key: 'testcase',   label: 'testcase ID',             re: /testcase\s*id|测试用例|用例\s*id/ },
  { key: 'failure',    label: 'failure description',    re: /failure\s*description|失败描述|问题描述|缺陷描述/ },
  { key: 'rootcause',  label: 'root cause analysis',    re: /root\s*cause|根因/ },
  { key: 'fix',        label: 'fix solution description', re: /fix\s*solution|修复方案|修复描述/ },
  { key: 'verify',     label: 'fix verification process', re: /fix\s*verification|verification\s*process|复测|验证过程|修复验证/ },
  { key: 'status',     label: 'bug status',             re: /^bug\s*status|^status|状态/ },
];

function readLines(p) {
  return fs.readFileSync(p, 'utf8').split(/\r?\n/);
}

// Split the document into tickets keyed by BUG id.
function parseTickets(lines) {
  const tickets = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(BUG_HDR_RE);
    if (m) {
      cur = { id: m[1], legacy: /previous\s*bug/i.test(line), lines: [] };
      tickets.push(cur);
    } else if (cur) cur.lines.push(line);
  }
  return tickets;
}

// Extract section headers from a ticket body. Accepts markdown headers
// (`# …`, `## …`) or bold labels (`**Root Cause…**`).
function parseSections(bodyLines) {
  const found = new Map();
  for (const raw of bodyLines) {
    const line = raw.trim();
    if (!line) continue;
    let header = '';
    let mh = line.match(/^#{1,6}\s+(.+?)\s*[:：]?\s*$/);
    if (mh) header = mh[1];
    else {
      const mb = line.match(/^\*\*\s*(.+?)\s*[:：]?\s*\*\*\s*[:：]?\s*$/);
      if (mb) header = mb[1];
    }
    if (!header) continue;
    const lc = header.toLowerCase();
    for (const s of SECTIONS) {
      if (s.re.test(lc) && !found.has(s.key)) found.set(s.key, header);
    }
  }
  return found;
}

function findStatus(ticket, sections) {
  // Status is taken ONLY from an explicit status line (`# bug status`, `status:`,
  // or `状态＝…`). Prose words elsewhere must never be mistaken for a status.
  const body = ticket.lines;
  for (let i = 0; i < body.length; i++) {
    const lc = body[i].toLowerCase();
    if (/^\s*(#{1,6}\s+)?\*\*?\s*(bug\s*)?status\b|^\s*(#{1,6}\s+)?\*\*?\s*(bug\s*)?状态|状态\s*[=：＝]/.test(lc)) {
      const joined = body.slice(i, i + 3).join(' ');
      for (const st of STATUSES) {
        if (new RegExp(`\\b${st}\\b`).test(joined)) return st;
      }
      const chinese = joined.match(/状态\s*[=：＝]\s*\**\s*([^\s*，。；;]+)/);
      if (chinese) return chinese[1].trim();
    }
  }
  return null;
}

// Minimal matrix row parser: returns [{ tst, result, bugs[] }].
function parseMatrix(lines) {
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (!inTable) {
        if (cells.some(c => /testcase\s*id/i.test(c))) inTable = true;
        continue;
      }
      if (/^[\s:|-]+$/.test(line)) continue;
      const tstCell = cells.find(c => /TST-\d{2}-/.test(c)) || '';
      const tst = (tstCell.match(/TST-\d{2}-(?:UT|CT|ST|GT|MT)-\d{4}/) || [null])[0];
      if (!tst) continue;
      const result = (cells.find(c => /^(pass|fail)$/i.test(c)) || '').toLowerCase();
      const bugCell = cells.find(c => /BUG-\d{2}-\d{4}/.test(c)) || '';
      rows.push({ tst, result, bugs: bugCell.match(BUGID_RE) || [] });
    } else inTable = false;
  }
  return rows;
}

function cmdCheck(bugPath, matrixPath, reportPath, prefix) {
  prefix = prefix || 'BUG-02';
  const errors = [], warnings = [];
  const all = parseTickets(readLines(bugPath));
  if (!all.length) errors.push('no bug tickets found (expected "## BUG-xx-yyyy" headers)');
  // Only the current phase (prefix, default BUG-02) is gated. Legacy tickets from
  // earlier phases predate the six-section format and are reported but not forced.
  const legacy = all.filter(t => !t.id.startsWith(prefix + '-') || t.legacy);
  const tickets = all.filter(t => t.id.startsWith(prefix + '-') && !t.legacy);
  legacy.forEach(t => warnings.push(`${t.id}: legacy ticket (outside ${prefix}) — format not enforced`));

  const statusById = new Map();
  const testcasesById = new Map();
  const legacyIds = new Set(legacy.map(t => t.id));

  for (const t of tickets) {
    const body = t.lines;
    const sections = parseSections(body);
    for (const s of SECTIONS) {
      if (!sections.has(s.key))
        errors.push(`${t.id}: missing required section "# ${s.label}" (bug-fix SKILL ticket format)`);
    }
    const tcs = body.join('\n').match(TST_RE) || [];
    testcasesById.set(t.id, new Set(tcs));
    if (!tcs.length)
      warnings.push(`${t.id}: no testcase ID referenced in ticket body`);

    const st = findStatus(t, sections);
    if (!st) errors.push(`${t.id}: no bug status recorded`);
    else if (!STATUSES.includes(st))
      errors.push(`${t.id}: invalid status "${st}" — must be one of ${STATUSES.join('/')}`);
    statusById.set(t.id, st);
  }

  // Matrix linkage.
  if (matrixPath && fs.existsSync(matrixPath)) {
    for (const r of parseMatrix(readLines(matrixPath))) {
      for (const bug of r.bugs) {
        if (legacyIds.has(bug)) continue; // legacy ticket: linkage not enforced
        const st = statusById.get(bug);
        if (st === undefined) { errors.push(`${r.tst}: references ${bug} which has no ticket`); continue; }
        if (!STATUSES.includes(st)) { errors.push(`${r.tst}: ${bug} has no valid status recorded`); continue; }
        const isFinal = FINAL.has(st);
        if (isFinal && r.result === 'fail')
          errors.push(`${r.tst}: ${bug} is final (${st}) but matrix row is FAIL — it must be PASS`);
        if (!isFinal && r.result === 'pass')
          errors.push(`${r.tst}: ${bug} is ${st} (not final) but matrix row is PASS — it stays FAIL until closed/cnn/fcp`);
      }
    }
  }

  const stamp = new Date().toISOString();
  const out = [];
  out.push(`BUG GATE: ${errors.length ? 'FAIL' : 'PASS'}  ${stamp}`);
  out.push(`bug table=${bugPath}${matrixPath ? `  matrix=${matrixPath}` : ''}  tickets=${tickets.length}`);
  const tally = {};
  for (const st of statusById.values()) tally[st] = (tally[st] || 0) + 1;
  out.push(`status tally=${Object.keys(tally).map(k => `${k}:${tally[k]}`).join('  ') || '-'}`);
  if (errors.length) {
    out.push(`\nERRORS (${errors.length}):`);
    errors.forEach(e => out.push(`  \u2717 ${e}`));
  }
  if (warnings.length) {
    out.push(`\nWARNINGS (${warnings.length}):`);
    warnings.forEach(w => out.push(`  ! ${w}`));
  }
  const text = out.join('\n') + '\n';
  process.stdout.write(text);
  if (reportPath) fs.writeFileSync(reportPath, text);
  process.exit(errors.length ? 1 : 0);
}

const args = process.argv.slice(2);
const cmd = args[0];
let prefix = 'BUG-02';
const pi = args.indexOf('--prefix');
if (pi >= 0) { prefix = args[pi + 1]; args.splice(pi, 2); }
const [, bugPath, matrixPath, reportPath] = args;
if (cmd === 'check' && bugPath) cmdCheck(bugPath, matrixPath, reportPath, prefix);
else {
  process.stderr.write('Usage: node bug-gate.js check <bugTable.md> [matrix.md] [report.txt]\n');
  process.exit(2);
}
