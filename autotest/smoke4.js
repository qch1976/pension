const automator = require('miniprogram-automator');
const cp = require('child_process');
const path = require('path');

const cliBat = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const projectPath = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const PORT = 9540;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function startCliAuto() {
  return new Promise((resolve, reject) => {
    const cmd = `"${cliBat}" auto --project "${projectPath}" --auto-port ${PORT}`;
    const child = cp.spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let all = '';
    const onData = d => {
      const t = d.toString();
      all += t;
      process.stdout.write('[cli] ' + t.trim() + '\n');
      // 就绪信号：auto 模式启动完成
      if (/IDE server has started|√ auto|\u221a auto/.test(all)) {
        resolve(child);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', e => reject(e));
    setTimeout(() => reject(new Error('cli auto timeout. tail=' + all.slice(-400))), 60000);
  });
}

(async () => {
  let cliProc = null;
  try {
    console.log('STEP1: 启动 cli auto ...');
    cliProc = await startCliAuto();
    console.log('cli auto 已就绪，等待 ws 服务 3s ...');
    await sleep(3000);

    console.log('STEP2: automator.connect ws://127.0.0.1:' + PORT);
    const mp = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${PORT}` });
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