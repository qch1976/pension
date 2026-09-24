'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const G = require('./lib-gui.js');
const out = path.join(G.OUT_DIR, 'cli-probe.log');
fs.writeFileSync(out, 'probe start ' + new Date().toISOString() + ' sid=' + G.sessionId() + '\n');
const cliBat = G.discoverCliBat();
const cmd = '"' + cliBat + '" auto --project "' + G.PROJECT + '" --auto-port ' + G.PORT;
fs.appendFileSync(out, 'CMD ' + cmd + '\n');
const child = cp.spawn(cmd, { shell: true, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: false });
let all = Buffer.alloc(0);
child.stdout.on('data', d => { all = Buffer.concat([all, d]); });
child.stderr.on('data', d => { all = Buffer.concat([all, d]); });
setTimeout(() => { try { child.stdin.write('y\r\n'); fs.appendFileSync(out, '>> sent y at 8s\n'); } catch (e) {} }, 8000);
child.on('exit', c => {
  fs.appendFileSync(out, 'EXIT code=' + c + ' at=' + new Date().toISOString() + '\n');
  fs.appendFileSync(out, '---RAW(utf8)---\n' + all.toString('utf8') + '\n');
  // check port after exit
  setTimeout(() => {
    const net = require('net');
    const sock = net.createConnection({ port: G.PORT, host: '127.0.0.1' });
    sock.once('connect', () => { fs.appendFileSync(out, 'PORT ' + G.PORT + ' LISTEN(connect ok)\n'); sock.destroy(); process.exit(0); });
    sock.once('error', e => { fs.appendFileSync(out, 'PORT ' + G.PORT + ' FAIL ' + e.message + '\n'); process.exit(0); });
    setTimeout(() => { fs.appendFileSync(out, 'PORT timeout\n'); process.exit(0); }, 3000);
  }, 3000);
});
setTimeout(() => { fs.appendFileSync(out, 'HARD-TIMEOUT raw=' + all.toString('utf8').slice(-800) + '\n'); try { child.kill(); } catch (e) {} process.exit(2); }, 75000);
