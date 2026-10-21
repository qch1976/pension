const automator = require('miniprogram-automator');
const cp = require('child_process');
const path = require('path');

const cliBat = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const projectPath = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const PORT = 9540;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 打开 debug 协议日志
process.env.DEBUG = 'automator:protocol';

function startCliAuto() {
  return new Promise((resolve, reject) => {
    const cmd = `"${cliBat}" auto --project "${projectPath}" --auto-port ${PORT}`;
    const child = cp.spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let all = '';
    const onData = d => { const t = d.toString(); all += t; if (/√\s*auto/.test(all) && /Using AppID/.test(all)) resolve(child); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', e => reject(e));
    setTimeout(() => reject(new Error('cli auto timeout')), 60000);
  });
}

async function connectWithRetry(port, retries = 10) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try { return await automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` }); }
    catch (e) { lastErr = e; await sleep(1500); }
  }
  throw lastErr;
}

(async () => {
  try {
    console.log('STEP1: cli auto ...');
    await startCliAuto();
    console.log('STEP2: connect ...');
    const mp = await connectWithRetry(PORT);
    console.log('CONNECT_OK');

    // 关键：connect 后 IDE 自动化通道需要时间就绪，先等待并做 checkVersion 握手
    await sleep(3000);
    try {
      await mp.checkVersion();
      console.log('CHECK_VERSION_OK');
    } catch (e) {
      console.log('checkVersion skip:', e.message);
    }

    // 用重试包裹对 IDE 的第一次真实调用
    let page = null;
    for (let i = 0; i < 10 && !page; i++) {
      try {
        page = await mp.currentPage();
      } catch (e) {
        console.log('currentPage retry', i, e.message);
        await sleep(2000);
      }
    }
    if (!page) throw new Error('currentPage 始终超时');

    console.log('CURRENT_PAGE:', page.path);
    const data = await page.data();
    console.log('DATA_KEYS:', Object.keys(data).slice(0, 20).join(','));

    const shot = path.join(__dirname, 'smoke-output.png');
    await mp.screenshot({ path: shot });
    console.log('SCREENSHOT_OK:', shot);

    await mp.close();
    console.log('ALL_OK');
    process.exit(0);
  } catch (e) {
    console.error('SMOKE_FAIL:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();