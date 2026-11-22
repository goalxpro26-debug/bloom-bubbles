const { chromium } = require('/home/hatch/workspace/tools/pw-shot/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/meta-chromium/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage','--allow-file-access-from-files','--autoplay-policy=no-user-gesture-required','--proxy-server=http://127.0.0.1:3129','--ignore-certificate-errors','--hatch-webgl-allowed-domains-file=/home/hatch/workspace/defold/projects/bloom-bubbles/verify/webgl-policy-all.txt','--hatch-webgl-allowed-domains-sha256=8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6'] });
  const page = await browser.newPage();
  page.on('console', m => { if (true) console.log('CONSOLE', m.type(), ':', m.text().slice(0,400)); });
  page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0,400)));
  await page.goto(process.argv[2], { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(15000);
  const t = await page.title();
  console.log('TITLE:', t);
  await browser.close();
})().catch(e => { console.error('SCRIPT ERR', e.message); process.exit(1); });
