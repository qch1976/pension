// cli40215-keeper.js — task-73 对齐 PLAYBOOK §7/§12 重写版常驻口启动器逻辑
// 由 cli40215-keeper.ps1 调用（node 执行）。空格安全：Node spawn 数组传参（§7 已验证方式），弃 8.3 短路径 workaround。
// 输出目录：工程外 C:\Users\Administrator\wechat-automation\runs\pension-cli40215\（§12.2，避免 IDE watch 触发 onFileChange 编译）。
// 逻辑：40215 已 LISTEN 则复用退出 0；否则 spawn cli auto(数组传参含空格真实路径) + 60s 轮询，超时退出 1。
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');

const CLI = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension'; // 含空格真实路径（Node 数组传参空格安全）
const PORT = 40215;
// §12.2：输出写工程外固定目录
const RUNS = 'C:\\Users\\Administrator\\wechat-automation\\runs\\pension-cli40215';
fs.mkdirSync(RUNS, { recursive: true });
const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const LOG = path.join(RUNS, `cli40215-${ts}.log`);

function log(line) {
  const s = `[${new Date().toISOString()}] ${line}\n`;
  try { fs.appendFileSync(LOG, s); } catch (e) {}
  process.stdout.write(s);
}

function portListening(port, timeoutMs, onTick) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const tryOnce = () => {
      const s = net.connect({ host: '127.0.0.1', port });
      s.once('connect', () => { s.end(); resolve(true); });
      s.once('error', () => {
        if (Date.now() - t0 > timeoutMs) return resolve(false);
        setTimeout(tryOnce, 3000);
        if (onTick) onTick();
      });
    };
    tryOnce();
  });
}

(async () => {
  log(`CLI_BEGIN auto --project "${PROJECT}" --auto-port ${PORT} (Node spawn shell:true, space-safe)`);

  // 前置依赖预检（项目主 21:48 裁定 B / PLAYBOOK §1 Step 1 + §12.1-8）：40215 由主 IDE NodeService 托管，
  // cli auto 需 IDE server 60964 已在跑（IDE 启动 + pension 工程已加载）。IDE 未就绪时强跑会致 0xC000013A。
  // 故 spawn 前先等 60964 LISTEN（IDE 就绪标志），最长等 90s（IDE 冷启动慢）；超时退出码 3（IDE_NOT_READY）。
  const IDE_PORT = 60964;
  if (!(await portListening(IDE_PORT, 0))) {
    log(`60964 NO-LISTEN -> IDE 未就绪，等待最多 90s ...`);
    const ideOk = await portListening(IDE_PORT, 90000);
    if (!ideOk) {
      log(`60964 timeout 90s -> IDE_NOT_READY (请先手动启动微信开发者工具加载 pension)。退出码 3`);
      process.exit(3);
    }
  }
  log(`60964 LISTEN -> IDE 已就绪，开始 spawn cli auto`);

  // §7 正解：spawn(完整命令字符串, {shell:true})——Node 用 shell 执行该字符串，引号在字符串里是字面量，
  // 不经 cmd /c 手动数组拼接（已实测 cmd /c 对嵌套引号+含空格路径 3 种写法均解析失败）。
  const cmdline = '"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + String(PORT);
  const child = spawn(cmdline, [], {
    cwd: PROJECT,
    shell: true,
    windowsHide: true,
  });
  const childLog = fs.createWriteStream(LOG, { flags: 'a' });
  child.stdout.pipe(childLog);
  child.stderr.pipe(childLog);
  child.on('error', (e) => log('spawn error: ' + e.message));
  log(`SPAWNED cli auto pid=${child.pid}`);

  let ticks = 0;
  const ok = await portListening(PORT, 60000, () => { ticks++; });
  if (ok) {
    log(`40215 LISTEN after ~${ticks * 3}s -> CLI_OK`);
    process.exit(0);
  } else {
    log(`40215 NO-LISTEN timeout 60s -> CLI_TIMEOUT (check log for code19/AppID)`);
    process.exit(1);
  }
})();
