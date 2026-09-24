/*
 * enable-cli.js (rerun 2026-09-20 14:50) - non-destructive service-port recovery.
 * IDE is already open with pension project in session 2, but .ide points at a dead
 * port (25636, nothing listening). Per RUNBOOK 11.3: remove stale .ide/.cli, then
 * run `cli auto` with 'y' piped to stdin (answers "enter y to confirm enabling CLI").
 * Does NOT kill IDE, does NOT open project via GUI. Then same readiness gate as start-cli:
 * currentPage path=pages/index/index AND data keys>5 within 90s, else SMOKE_ENV_DEFECT.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const net = require('net');
const cp = require('child_process');
const G = require('./lib-gui.js');

const SMOKE = path.join(G.OUT_DIR, 'result-smoke.json');
const sleep = G.sleep;
const log = [];
const L = m => { const s = '[' + new Date().toISOString() + '] ' + m; log.push(s); try { console.log(s); } catch (e) {} };

function portListening(port) {
  return new Promise(resolve => {
    const sock = net.createConnection({ port, host: '127.0.0.1' });
    const done = v => { try { sock.destroy(); } catch (e) {} resolve(v); };
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    setTimeout(() => done(false), 1500);
  });
}

(async () => {
  let child = null;
  try {
    // 1) remove stale IDE port files (running IDE rewrites them; cli without them re-attaches/enables)
    const base = path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data',
      '2ca4252ffa87560ea1fd48b913e45179', 'Default');
    for (const name of ['.ide', '.cli']) {
      const fp = path.join(base, name);
      try { if (fs.existsSync(fp)) { fs.unlinkSync(fp); L('removed stale ' + name); } } catch (e) { L('cannot remove ' + name + ': ' + e.message); }
    }
    await sleep(500);

    const cliBat = G.discoverCliBat();
    L('cli=' + cliBat + ' port=' + G.PORT + ' sid=' + G.sessionId());
    const cmd = '"' + cliBat + '" auto --project "' + G.PROJECT + '" --auto-port ' + G.PORT;
    child = cp.spawn(cmd, { shell: true, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: false });
    let raw = Buffer.alloc(0), tail = '';
    let ySent = false;
    const hasCheckAuto = () => {
      for (let i = 0; i + 1 < raw.length; i++) {
        if (raw[i] === 0xA1 && raw[i + 1] === 0xCC) return true;
        if (raw[i] === 0xE2 && raw[i + 1] === 0x88 && raw[i + 2] === 0x9A) return true;
      }
      return false;
    };
    const onData = d => {
      raw = Buffer.concat([raw.slice(-16000), d]);
      tail += d.toString('utf8');
      if (tail.length > 16000) tail = tail.slice(-16000);
      const s = d.toString('utf8').replace(/\s+/g, ' ').trim();
      if (s) L('cli: ' + s.slice(0, 200));
      if (!ySent && /enter y|confirm enabling|CLI capability/i.test(tail)) {
        try { child.stdin.write('y\r\n'); ySent = true; L('sent y to cli'); } catch (e) {}
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', c => L('cli child exited code=' + c));
    // also send y after 6s unconditionally (prompt bytes may be mangled in codepage)
    setTimeout(() => { if (!ySent) { try { child.stdin.write('y\r\n'); ySent = true; L('sent y (proactive)'); } catch (e) {} } }, 6000);

    let marker = false, appid = false, listen = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 150000) {
      marker = hasCheckAuto();
      appid = /Using AppID/.test(tail);
      if (marker && appid) break;
      if (child.exitCode != null && Date.now() - t0 > 15000) {
        // cli exits after enabling; port may still come up in IDE
        L('cli exited early; continuing to wait for port');
        break;
      }
      await sleep(2000);
    }
    L('markers checkAuto=' + marker + ' appID=' + appid);
    listen = await G.waitPort(G.PORT, 90000);
    L('port ' + G.PORT + ' listen=' + listen);
    if (!(appid && listen)) throw new Error('cli enable failed: appID=' + appid + ' listen=' + listen);

    // 2) readiness gate 90s, fresh socket per probe
    let pagePath = '', dataKeys = [], ready = false, lastErr = '', launched = false;
    const w0 = Date.now();
    while (Date.now() - w0 < 90000) {
      let sock = null;
      try {
        sock = await G.connect(4);
        try { await sock.checkVersion(); } catch (e) {}
        if (!launched) { await sock.reLaunch('/pages/index/index').catch(() => {}); launched = true; await sleep(5000); }
        const page = await sock.currentPage();
        pagePath = page.path;
        if (pagePath === 'pages/index/index') {
          dataKeys = Object.keys((await page.data()) || {});
          if (dataKeys.length > 5) ready = true;
        }
      } catch (e) { lastErr = String(e && e.message || e); }
      finally { try { await sock.close(); } catch (e) {} }
      if (ready) break;
      await sleep(5000);
    }
    L('webview ready=' + ready + ' path=' + pagePath + ' dataKeys=' + dataKeys.length + (lastErr ? ' lastErr=' + lastErr.slice(0, 150) : ''));

    const shot = path.join(G.OUT_DIR, 'smoke-simulator.png');
    const desk = path.join(G.OUT_DIR, 'smoke-desktop.png');
    let bytes = 0, png = null, deskBytes = 0, deskPng = null;
    if (ready) {
      try { fs.unlinkSync(shot); } catch (e) {}
      for (let att = 1; att <= 3 && bytes === 0; att++) {
        let sc = null;
        try {
          sc = await G.connect(4);
          await sleep(2000);
          await sc.screenshot({ path: shot });
          await sleep(400);
          if (fs.existsSync(shot) && fs.statSync(shot).size > 10240) bytes = fs.statSync(shot).size;
        } catch (e) { L('shot attempt ' + att + ' failed: ' + e.message); await sleep(3000); }
        finally { try { await sc.close(); } catch (e) {} }
      }
      try { png = G.validatePng(shot); } catch (e) { png = { error: e.message }; }
      L('sim shot bytes=' + bytes + ' png=' + JSON.stringify(png));
      const ps = "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap($b.Width,$b.Height); $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('" + desk + "'); $g.Dispose(); $bmp.Dispose();";
      try { cp.execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], { encoding: 'utf8' }); await sleep(300); deskBytes = fs.statSync(desk).size; deskPng = G.validatePng(desk); } catch (e) { L('desk warn: ' + e.message); }
    }

    const simOk = bytes > 10240 && png && png.nonWhitePct > 1 && png.distinctColors >= 30;
    const deskOk = deskBytes > 50000 && deskPng && deskPng.nonWhitePct > 50;
    const ok = ready && listen && simOk && deskOk;
    const summary = {
      ok, case: 'smoke', suite: 'pension-gui-rerun-20260920', stage: 'smoke',
      defect: ready ? null : 'environment-session: simulator webview not ready within 90s',
      markers: { checkAuto: marker, usingAppID: appid, portListen: listen, port: G.PORT },
      page: pagePath, dataKeys, webviewReady: ready,
      screenshot: ready ? shot : null, screenshotBytes: bytes, png, simulatorNonBlank: simOk,
      desktopScreenshot: ready ? desk : null, desktopScreenshotBytes: deskBytes, desktopPng: deskPng,
      runContext: { sessionId: G.sessionId(), automationPort: G.PORT, project: G.PROJECT },
      logTail: log.slice(-14), finishedAt: new Date().toISOString()
    };
    fs.writeFileSync(SMOKE, JSON.stringify(summary, null, 2), 'utf8');
    fs.writeFileSync(path.join(G.OUT_DIR, 'ready.json'),
      JSON.stringify({ ready: ok, port: G.PORT, at: new Date().toISOString() }), 'utf8');
    if (ok) {
      L('SMOKE_DONE ok=true');
      // automation service lives inside the IDE process; cases connect on their own.
      try { if (child) child.kill(); } catch (e) {}
      process.exit(0);
    } else { L('SMOKE_ENV_DEFECT'); try { if (child) child.kill(); } catch (e) {} process.exit(2); }
  } catch (e) {
    L('FATAL ' + (e && e.stack || e));
    fs.writeFileSync(SMOKE, JSON.stringify({ ok: false, case: 'smoke', fatal: String(e && e.message || e), log: log.slice(-30), finishedAt: new Date().toISOString() }, null, 2), 'utf8');
    process.exit(1);
  }
})();
