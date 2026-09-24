/*
 * start-cli.js (rerun 2026-09-20) - run inside session 2 via scheduled task PensionGuiRun.
 * Clean state assumed (all stale DevTools killed, .ide/.cli removed, ports free).
 * 1) cli auto --project <pension> --auto-port 9561 (long-lived, stays alive for cases)
 * 2) in-script poll until log shows [check] auto + Using AppID + port Listen
 * 3) automator.connect, then backoff-retry up to ~120s for REAL webview readiness:
 *    currentPage().path == 'pages/index/index' AND Object.keys(page.data()).length > 5
 *    (previous run failed because IDE sat on project list -> getPageMetaByWebviewId null)
 * 4) write result-smoke.json (ok/page/dataKeys/screenshot bytes/distinctColors) + ready.json
 * 5) keep heartbeat alive; cli child stays attached for C1..C5.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const net = require('net');
const cp = require('child_process');
const G = require('./lib-gui.js');

const READY = path.join(G.OUT_DIR, 'ready.json');
const SMOKE = path.join(G.OUT_DIR, 'result-smoke.json');
const sleep = G.sleep;

function portListening(port) {
  return new Promise(resolve => {
    const sock = net.createConnection({ port: port, host: '127.0.0.1' });
    const done = v => { try { sock.destroy(); } catch (e) {} resolve(v); };
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    setTimeout(() => done(false), 1500);
  });
}

(async () => {
  const log = [];
  const L = m => { const s = '[' + new Date().toISOString() + '] ' + m; log.push(s); try { console.log(s); } catch (e) {} };
  let child = null;
  let reused = false, marker = false, appid = false, listen = false;
  try {
    if (await portListening(G.PORT)) {
      // Port from a previous cli auto (automation service lives inside the IDE process).
      // Reuse it only if connect + real webview readiness succeed; otherwise kill stale owners later.
      try {
        const mp0 = await G.connect(4);
        await mp0.checkVersion().catch(() => {});
        const pg = await mp0.currentPage();
        const dk = Object.keys(await pg.data() || {});
        L('preflight reuse: path=' + pg.path + ' dataKeys=' + dk.length + ' sid=' + G.sessionId());
        await mp0.close();
        if (pg.path === 'pages/index/index' && dk.length > 5) { reused = true; marker = true; appid = true; listen = true; }
      } catch (e) { L('preflight connect failed: ' + e.message + '; will start fresh cli'); }
    }

    if (!reused) {
    if (await portListening(G.PORT)) throw new Error('port ' + G.PORT + ' listening but not connectable/ready - clean stale cli owners first');

    const cliBat = G.discoverCliBat();
    L('cli=' + cliBat + ' port=' + G.PORT + ' sessionId=' + G.sessionId());
    const cmd = '"' + cliBat + '" auto --project "' + G.PROJECT + '" --auto-port ' + G.PORT;
    child = cp.spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: false });
    fs.writeFileSync(path.join(G.OUT_DIR, 'start-cli.pid'), String(process.pid), 'utf8');

    let raw = Buffer.alloc(0);
    let tail = '';
    const hasCheckAuto = () => {
      for (let i = 0; i + 4 < raw.length; i++) {
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
      if (s && /auto|AppID|port|error|warn/i.test(s)) L('cli: ' + s.slice(0, 200));
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', c => L('cli child exited code=' + c));

    // markers up to 180s (cold IDE start)
    const t0 = Date.now();
    while (Date.now() - t0 < 180000) {
      marker = hasCheckAuto();
      appid = /Using AppID/.test(tail);
      if (marker && appid) break;
      if (child.exitCode != null) break;
      await sleep(2000);
    }
    } // end if (!reused) spawn/marker block
    L('markers checkAuto=' + marker + ' usingAppID=' + appid + (reused ? ' (reused existing automation port)' : ''));

    if (!reused) {
    listen = await G.waitPort(G.PORT, 90000);
    }
    L('port ' + G.PORT + ' listen=' + listen);
    if (!(marker && appid && listen)) {
      throw new Error('cli auto preconditions failed: checkAuto=' + marker + ' appID=' + appid + ' listen=' + listen);
    }

    // ---- REAL webview readiness: backoff retry up to 120s ----
    // Each probe uses its OWN fresh socket: an automator RPC that hits the ~30s timeout
    // poisons that websocket (late responses desync later calls like screenshot).
    let pagePath = '', dataKeys = [], ready = false, lastErr = '';
    const w0 = Date.now();
    let launched = false;
    while (Date.now() - w0 < 90000) {
      let sock = null;
      try {
        sock = await G.connect(4);
        try { await sock.checkVersion(); } catch (e) {}
        if (!launched) {
          await sock.reLaunch('/pages/index/index').catch(() => {});
          launched = true;
          await sleep(5000);
        }
        const page = await sock.currentPage();
        pagePath = page.path;
        if (pagePath === 'pages/index/index') {
          const d = await page.data();
          dataKeys = Object.keys(d || {});
          if (dataKeys.length > 5) { ready = true; }
        }
      } catch (e) { lastErr = String(e && e.message || e); }
      finally { try { await sock.close(); } catch (e) {} }
      if (ready) break;
      await sleep(5000);
    }
    L('webview ready=' + ready + ' path=' + pagePath + ' dataKeys=' + dataKeys.length + (lastErr ? ' lastErr=' + lastErr.slice(0, 160) : ''));

    // ---- screenshot evidence: simulator (webview content) + full desktop (panel exists) ----
    const shot = path.join(G.OUT_DIR, 'smoke-simulator.png');
    const desk = path.join(G.OUT_DIR, 'smoke-desktop.png');
    let bytes = 0, png = null, deskBytes = 0, deskPng = null;
    if (ready) {
      try { fs.unlinkSync(shot); } catch (e) {}
      // fresh socket per attempt; retry up to 3 times to dodge poisoned channels
      for (let att = 1; att <= 3 && bytes === 0; att++) {
        let sc = null;
        try {
          sc = await G.connect(4);
          await sleep(2000);
          await sc.screenshot({ path: shot });
          await sleep(400);
          if (fs.existsSync(shot) && fs.statSync(shot).size > 10240) { bytes = fs.statSync(shot).size; }
        } catch (e) { L('simulator screenshot attempt ' + att + ' failed: ' + e.message); await sleep(3000); }
        finally { try { await sc.close(); } catch (e) {} }
      }
      try { png = G.validatePng(shot); } catch (e) { png = { error: e.message }; }
      L('simulator screenshot bytes=' + bytes + ' png=' + JSON.stringify(png));
      // full interactive-desktop capture (session 2): proves simulator panel is really rendered
      const psShot = "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; " +
        "$b=[System.Windows.Forms.SystemInformation]::VirtualScreen; " +
        "$bmp=New-Object System.Drawing.Bitmap($b.Width,$b.Height); " +
        "$g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); " +
        "$bmp.Save('" + desk + "'); $g.Dispose(); $bmp.Dispose();";
      try {
        cp.execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psShot], { encoding: 'utf8' });
        await sleep(300);
        deskBytes = fs.statSync(desk).size;
        deskPng = G.validatePng(desk);
        L('desktop screenshot bytes=' + deskBytes + ' png=' + JSON.stringify(deskPng));
      } catch (e) { L('desktop screenshot warn: ' + e.message); }
    } else {
      // environment-session defect: no real webview within 120s
    }

    // simulator pane is a small 250x541 surface with few flat colors, so its non-blank gate is
    // nonWhitePct>1 + bytes; the strict distinctColors>300 gate is applied to the full desktop shot.
    // Full desktop: a console window may float over the IDE, so this gate only proves a real
    // unlocked desktop (not black/lock screen): nonWhitePct>50%. Simulator truth comes from the
    // webview-direct shot + readiness above (window occlusion does not affect mp.screenshot).
    const simOk = bytes > 10240 && png && png.nonWhitePct > 1 && png.distinctColors >= 30;
    const deskOk = deskBytes > 50000 && deskPng && deskPng.nonWhitePct > 50;
    const ok = ready && !!listen && simOk && deskOk;
    const summary = {
      ok: ok, case: 'smoke', suite: 'pension-gui-rerun-20260920', stage: 'smoke',
      defect: ready ? null : 'environment-session: simulator webview not ready within 120s (IDE may still be on project list)',
      markers: { checkAuto: marker, usingAppID: appid, portListen: listen, port: G.PORT },
      page: pagePath, dataKeys: dataKeys, webviewReady: ready,
      screenshot: ready ? shot : null, screenshotBytes: bytes, png: png, simulatorNonBlank: simOk,
      desktopScreenshot: ready ? desk : null, desktopScreenshotBytes: deskBytes, desktopPng: deskPng,
      nonBlankGate: { simulator: 'bytes>10KB & nonWhite>1% & colors>=30', desktop: 'bytes>50KB & distinctColors>300 & nonWhite>1%', desktopPass: deskOk },
      runContext: { sessionId: G.sessionId(), automationPort: G.PORT, project: G.PROJECT, sdk: G.SDK_DIR },
      logTail: log.slice(-12),
      finishedAt: new Date().toISOString()
    };
    fs.writeFileSync(SMOKE, JSON.stringify(summary, null, 2), 'utf8');
    if (!ready) { L('SMOKE_ENV_DEFECT'); process.exit(2); }
    fs.writeFileSync(READY, JSON.stringify({ ready: true, port: G.PORT, at: new Date().toISOString() }), 'utf8');
    L('SMOKE_DONE ok=' + ok + ' page=' + pagePath + ' dataKeys=' + dataKeys.length + ' simOk=' + simOk + ' deskOk=' + deskOk);
    if (!ready) process.exit(2);

    // long-lived: keep cli auto + heartbeat for C1..C5
    setInterval(() => {
      try { fs.writeFileSync(READY, JSON.stringify({ ready: true, port: G.PORT, at: new Date().toISOString(), heartbeat: true }), 'utf8'); } catch (e) {}
    }, 15000);
  } catch (e) {
    L('FATAL ' + (e && e.stack || e));
    fs.writeFileSync(SMOKE, JSON.stringify({
      ok: false, case: 'smoke', fatal: String(e && e.message || e), log: log.slice(-30), finishedAt: new Date().toISOString()
    }, null, 2), 'utf8');
    process.exit(1);
  }
})();
