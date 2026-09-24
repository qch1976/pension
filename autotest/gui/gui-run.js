/*
 * gui-run.js (rerun) - executed in session 2 by scheduled task PensionGuiRun.
 * job.txt line format: <script.js>[|arg1|arg2...]
 * SSH only triggers schtasks /Run and polls job-result.json.
 * start-* scripts spawn detached and stay alive (cli auto owner).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const DIR = __dirname;
const JOB = path.join(DIR, 'job.txt');
const RESULT = path.join(DIR, 'job-result.json');
const LOG = path.join(DIR, 'run.log');

function log(msg) {
  fs.appendFileSync(LOG, '[' + new Date().toISOString() + '] ' + msg + '\n', 'utf8');
}

(async () => {
  try {
    const raw = fs.readFileSync(JOB, 'utf8').trim();
    const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
    const script = parts[0];
    const args = parts.slice(1);
    const exe = process.execPath;
    fs.writeFileSync(RESULT, JSON.stringify({ state: 'running', target: raw, startedAt: new Date().toISOString() }), 'utf8');
    log('job start: ' + raw);
    const detached = /(^|[\\/])start-/.test(path.basename(script));
    const out = fs.openSync(path.join(DIR, 'job-stdout.log'), 'a');
    const err = fs.openSync(path.join(DIR, 'job-stderr.log'), 'a');
    if (detached) {
      const child = cp.spawn(exe, [script].concat(args), {
        cwd: path.dirname(script), detached: true, stdio: ['ignore', out, err], windowsHide: false
      });
      child.unref();
      fs.writeFileSync(RESULT, JSON.stringify({ state: 'detached', pid: child.pid, target: raw, startedAt: new Date().toISOString() }), 'utf8');
      log('detached spawn pid=' + child.pid);
      setTimeout(() => process.exit(0), 1500);
      return;
    }
    const code = await new Promise(resolve => {
      const child = cp.spawn(exe, [script].concat(args), { cwd: path.dirname(script), stdio: ['ignore', out, err] });
      child.on('close', resolve);
      child.on('error', e => { log('spawn error: ' + e.message); resolve(999); });
    });
    fs.writeFileSync(RESULT, JSON.stringify({ state: 'done', code: code, target: raw, finishedAt: new Date().toISOString() }), 'utf8');
    log('job done code=' + code);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(RESULT, JSON.stringify({ state: 'error', error: String(e && e.message || e), finishedAt: new Date().toISOString() }), 'utf8');
    log('job error: ' + (e && e.stack || e));
    process.exit(1);
  }
})();
