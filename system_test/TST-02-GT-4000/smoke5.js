const automator = require('miniprogram-automator');
const cp = require('child_process');
const path = require('path');

const cliBat = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const projectPath = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const PORT = 9540;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 等待真正就绪信号：√ auto（ws 服务此时才监听 --auto-port）
function startCliAuto() {
  return new Promise((resolve, reject) => {
    const cmd = `"${cliBat}" auto --project "${projectPath}" --auto-port ${PORT}`;
    const child = cp.spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let all = '';
    const onData = d => {
      const t = d.toString();
      all += t;
      process.stdout.write('[cli] ' + t.trim() + '\n');
      // 就绪：出现 √ auto 完成标记
      if (/√\s*auto|auto\s*$/.test(all.trim()) && /Using AppID/.test(all)) {
        resolve(child);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', e => reject(e));
    setTimeout(() => reject(new Error('cli auto timeout. tail=' + all.slice(-400))), 60000);
  });
}

// 带重试的 connect
async function connectWithRetry(port, retries = 10) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const mp = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` });
      return mp;
    } catch (e) {
      lastErr = e;
      await sleep(1500);
    }
  }
  throw lastErr;
}

(async () => {
  let cliProc = null;
  try {
    console.log('STEP1: 启动 cli auto（等待 √ auto 就绪）...');
    cliProc = await startCliAuto();
    console.log('cli auto 已完全就绪');

    console.log('STEP2: connect（重试）ws://127.0.0.1:' + PORT);
    const mp = await connectWithRetry(PORT);
    console.log('CONNECT_OK ✓');

    const page = await mp.reLaunch('/pages/index/index');
    await page.waitFor(1500);
    console.log('RELAUNCH_OK: /pages/index/index');

    const data = await page.data();
    console.log('PAGE_DATA_KEYS:', Object.keys(data).slice(0, 20).join(','));

    const shot = path.join(__dirname, 'smoke-output.png');
    await page.screenshot({ path: shot });
    console.log('SCREENSHOT_OK:', shot);

    await mp.close();
    console.log('ALL_OK');
    process.exit(0);
  } catch (e) {
    console.error('SMOKE_FAIL:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();