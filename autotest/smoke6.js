const automator = require('miniprogram-automator');
const cp = require('child_process');
const path = require('path');

const cliBat = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const projectPath = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const PORT = 9540;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function startCliAuto() {
  return new Promise((resolve, reject) => {
    const cmd = `"${cliBat}" auto --project "${projectPath}" --auto-port ${PORT}`;
    const child = cp.spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let all = '';
    const onData = d => {
      const t = d.toString();
      all += t;
      process.stdout.write('[cli] ' + t.trim() + '\n');
      if (/√\s*auto/.test(all) && /Using AppID/.test(all)) resolve(child);
    };
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
    console.log('STEP1: 启动 cli auto ...');
    await startCliAuto();
    console.log('STEP2: connect ...');
    const mp = await connectWithRetry(PORT);
    console.log('CONNECT_OK ✓');

    // 先看 pageStack 和 currentPage（不主动 reLaunch，避免超时）
    const stack = await mp.pageStack();
    console.log('PAGE_STACK:', JSON.stringify(stack).slice(0, 300));
    const cur = await mp.currentPage();
    console.log('CURRENT_PAGE:', cur ? cur.path : 'null');

    // 尝试 evaluate 探测
    if (cur) {
      const info = await cur.evaluate(() => {
        return { ready: typeof Page === 'function', title: document.title || '' };
      });
      console.log('EVAL:', JSON.stringify(info));
    }

    console.log('STEP3: 截图...');
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