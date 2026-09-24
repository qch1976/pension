const automator = require('miniprogram-automator');
const cp = require('child_process');
const path = require('path');

const cliBat = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const projectPath = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const PORT = 9540; // 固定一个空闲端口

function startCliAuto() {
  return new Promise((resolve, reject) => {
    // 关键修复：cmd.exe /c 包装，避免 Node spawn .bat 的 EINVAL
    const child = cp.spawn('cmd.exe', ['/c', '"' + cliBat + '"', 'auto', '--project', projectPath, '--auto-port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', d => { out += d; console.log('[cli]', d.toString().trim()); });
    child.stderr.on('data', d => console.log('[cli:err]', d.toString().trim()));
    child.on('error', e => reject(e));
    // cli auto 是常驻进程，启动成功即 resolve（等 IDE server started）
    const timer = setInterval(() => {
      if (out.includes('IDE server has started') || out.includes('√ auto')) {
        clearInterval(timer);
        resolve(child);
      }
    }, 500);
    // 超时保护
    setTimeout(() => { clearInterval(timer); reject(new Error('cli auto start timeout: ' + out.slice(-300))); }, 45000);
  });
}

(async () => {
  let cliProc = null;
  try {
    console.log('STEP1: 启动 cli auto (cmd 包装) ...');
    cliProc = await startCliAuto();
    console.log('STEP2: automator.connect ws 端口', PORT, '...');
    const mp = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${PORT}` });
    console.log('CONNECT_OK, 小程序已连接');

    const page = await mp.reLaunch('/pages/index/index');
    await page.waitFor(1500);
    console.log('RELAUNCH_OK /pages/index/index');

    // 抓首页文本抽样
    const data = await page.data();
    console.log('PAGE_DATA_KEYS:', Object.keys(data).slice(0, 15).join(','));

    // 截图留证
    const shot = path.join(__dirname, 'smoke-output.png');
    await page.screenshot({ path: shot });
    console.log('SCREENSHOT_OK:', shot);

    await mp.close();
    console.log('CLOSE_OK');
    process.exit(0);
  } catch (e) {
    console.error('SMOKE_FAIL:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();