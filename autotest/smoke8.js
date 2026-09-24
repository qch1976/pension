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
    const onData = d => { const t = d.toString(); all += t; if (/√\s*auto/.test(all) && /Using AppID/.test(all)) resolve(child); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', e => reject(e));
    setTimeout(() => reject(new Error('cli auto timeout')), 60000);
  });
}

async function connectWithRetry(port, retries = 15) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try { return await automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` }); }
    catch (e) { lastErr = e; await sleep(2000); }
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

    console.log('STEP3: 预热 12s（等 IDE 编译渲染完成）...');
    await sleep(12000);

    // 直接截图（最核心证据）
    console.log('STEP4: screenshot ...');
    const shot = path.join(__dirname, 'smoke-output.png');
    await mp.screenshot({ path: shot });
    console.log('SCREENSHOT_OK:', shot);

    // 再试拿页面数据
    try {
      const stack = await mp.pageStack();
      console.log('PAGE_STACK_OK:', JSON.stringify(stack.map(p => p.path)));
    } catch (e) {
      console.log('pageStack 失败(继续):', e.message);
    }

    await mp.close();
    console.log('ALL_OK');
    process.exit(0);
  } catch (e) {
    console.error('SMOKE_FAIL:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();