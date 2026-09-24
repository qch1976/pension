const automator = require('miniprogram-automator');
const path = require('path');

const cliPath = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const projectPath = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';

(async () => {
  try {
    const mp = await automator.launch({
      cliPath,
      projectPath,
      timeout: 60000,
    });
    console.log('LAUNCH_OK');
    console.log('PAGES:', JSON.stringify(await mp.pageStack ? mp : null).slice(0, 200));

    // 获取当前页面，断言首页关键元素
    const page = await mp.reLaunch('/pages/index/index');
    await page.waitFor(1500);
    console.log('RELAUNCH_OK');

    const title = await page.$('.page-title');
    if (title) {
      console.log('TITLE_FOUND:', await title.text());
    } else {
      console.log('TITLE_NOT_FOUND (checking generic)');
      const t = await page.$('view');
      console.log('FIRST_VIEW_TEXT:', t ? (await t.text()).slice(0, 80) : 'none');
    }

    // 截图留证
    await page.screenshot({ path: path.join(__dirname, 'smoke-output.png') });
    console.log('SCREENSHOT_OK');

    await mp.close();
    console.log('CLOSE_OK');
    process.exit(0);
  } catch (e) {
    console.error('SMOKE_FAIL:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();