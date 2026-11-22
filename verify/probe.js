// Quick boot probe: load the game, dump all console output + DOM state.
const { chromium } = require('/home/hatch/workspace/tools/pw-shot/node_modules/playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage',
      '--allow-file-access-from-files',
      '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--hatch-webgl-allowed-domains-file=/home/hatch/workspace/defold/projects/bloom-bubbles/verify/webgl-policy-all.txt',
      '--hatch-webgl-allowed-domains-sha256=8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6',
      '--autoplay-policy=no-user-gesture-required',
      '--proxy-server=http://127.0.0.1:3129',
      '--ignore-certificate-errors'],
  });
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('console', (m) => console.log('CONSOLE[' + m.type() + ']:', m.text().slice(0, 400)));
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 400)));
  page.on('requestfailed', (r) => console.log('REQFAIL:', r.url().slice(0, 160), (r.failure() || {}).errorText));
  const url = process.argv[2];
  await page.goto(url, { waitUntil: 'load' });
  for (let i = 0; i < 6; i++) {
    await sleep(3000);
    const info = await page.evaluate(() => ({
      title: document.title,
      canvas: !!document.querySelector('canvas'),
      canvasSize: (() => { const c = document.querySelector('canvas'); return c ? c.width + 'x' + c.height : null; })(),
      bodyText: document.body.innerText.slice(0, 200),
      module: typeof window.Module !== 'undefined',
      gd: typeof window.GD_OPTIONS !== 'undefined',
    }));
    console.log('T+' + (i + 1) * 3 + 's:', JSON.stringify(info));
  }
  await page.screenshot({ path: '/tmp/probe.png' });
  await browser.close();
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
