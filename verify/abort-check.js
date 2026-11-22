// Fast abort check: load page, wait 10s, report whether the
// res_gameobject assertion fired or the game reached a BLOOM state.
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
      '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  let aborted = false;
  let bloom = false;
  page.on('console', (m) => {
    if (m.text().includes('Assertion failed')) aborted = true;
  });
  page.on('pageerror', (e) => {
    if (String(e).includes('Assertion failed')) aborted = true;
  });
  await page.goto(process.argv[2], { waitUntil: 'load' });
  for (let i = 0; i < 10; i++) {
    await sleep(1000);
    const t = await page.title();
    if (t.startsWith('BLOOM|')) { bloom = true; break; }
    if (aborted) break;
  }
  console.log(aborted ? 'ABORT' : (bloom ? 'BOOTED-BLOOM' : 'NO-ABORT-NO-BLOOM'));
  await browser.close();
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
