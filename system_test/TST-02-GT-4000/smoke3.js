const automator = require('miniprogram-automator');
const cp = require('child_process');
const path = require('path');

const cliBat = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const projectPath = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const PORT = 9540;

function startCliAuto() {
  return new Promise((resolve, reject) => {
    const cmd = `"${cliBat}" auto --project "${projectPath}" --auto-port ${PORT}`;
    console.log('[cmd]', cmd);
    // shell:true 让 Node 用 cmd.exe 执行整条命令（.bat 需要 shell 解释）
    const child = cp.spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', d => { out += d; if (/IDE server|√ auto|Using AppID/.test(d)) console.log('[cli]', d.toString().trim()); });
    child.stderr.on('data', d => console.log('[cli:err]', d.toString().trim()));
    child.on('error', e => reject(e));
    const timer = setInterval(() => {
      if (out.includes('IDE server has started') || out.includes('√ auto') || out.includes('auto')) {
        clearInterval(timer);
        resolve(child);
      }
    }, 500);
    setTimeout(() => { clearInterval(timer); reject(new Error('cli auto start timeout: ' + out.slice(-400))); }, 45000);
  });
}

(async () => {
  let cliProc = null;
  try {
    console.log('STEP1: 启动 cli auto (shell:true) ...');
    cliProc = await startCliAuto();
    console.log('STEP2: automator.connect ws://127.0.0.1:' + PORT, '...');
    const mp = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${PORT}` });
    console.log('CONNECT_OK');

    const page = await mp.reLaunch('/pages/index/index');
    await page.waitFor(1500);
    console.log('RELAUNCH_OK');

    const data = await page.data();
    console.log('PAGE_DATA_KEYS:', Object.keys(data).slice(0, 20).join(','));

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