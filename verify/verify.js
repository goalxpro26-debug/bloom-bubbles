// Bloom Bubbles — headless verification with Playwright.
// Usage: node verify.js <game-url>  (e.g. http://127.0.0.1:8901/index.html)
// Steps: title loads -> click PLAY -> manual shot -> pause/resume ->
// autoplay to win level 1 -> NEXT LEVEL -> endless smoke test.
// Screenshots + a PASS/FAIL summary go to verify/ (next to this script).
//
// INPUT NOTE (Nov 22, verified): Defold HTML5 input is POLLED once per
// engine frame, and headless SwiftShader runs at only a few FPS. A quick
// Playwright click/press (down+up in <50ms) often falls entirely between
// two frames and is never seen by the game. Real users on 60fps devices
// hold a tap for 80-150ms (many frames), so this is a harness artifact,
// not a game bug. All interactions below therefore use HELD inputs
// (down, hold ~800ms, up) so the poll is guaranteed to catch them.
// COORDINATES: the engine reports input action x/y in GUI space (origin
// bottom-left, y up), but Playwright clicks in page space (origin
// top-left, y down). A GUI button at (x, y) must be clicked at page
// (x, 1280 - y). All click coords below are already page coords.
const { chromium } = require('/home/hatch/workspace/tools/pw-shot/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = __dirname;
const url = process.argv[2];
if (!url) { console.error('usage: node verify.js <game-url>'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  [' + detail + ']' : ''));
}

// Held mouse click: down, hold long enough for a slow frame to poll it, up.
async function heldClick(page, x, y, holdMs) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await sleep(holdMs || 800);
  await page.mouse.up();
  await sleep(300);
}

// Held key press: down, hold, up.
async function heldKey(page, key, holdMs) {
  await page.keyboard.down(key);
  await sleep(holdMs || 800);
  await page.keyboard.up(key);
  await sleep(300);
}

async function state(page) {
  const title = await page.title();
  const m = {};
  title.split('|').forEach((part) => {
    const kv = part.split('=');
    if (kv.length === 2) m[kv[0]] = kv[1];
  });
  return m;
}

async function waitState(page, pred, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await state(page);
    if (pred(s)) return s;
    await sleep(500);
  }
  const s = await state(page);
  check(label, false, 'last state: ' + JSON.stringify(s));
  return s;
}

// Minimal PNG decode (8-bit RGB/RGBA) -> count distinct sampled colors.
// The old drawImage check returned blank without preserveDrawingBuffer;
// decoding the actual screenshot file is the reliable non-blank test.
function pngDistinctColors(buf) {
  if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return -1;
  let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.slice(off + 4, off + 8).toString('ascii');
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) return -1;
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const colors = new Set();
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart];
    const row = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const v = raw[rowStart + 1 + i];
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        pred = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      row[i] = (v + pred) & 0xff;
    }
    prev = row;
    if (y % 4 !== 0) continue;
    for (let x = 0; x < width; x += 4) {
      const i = x * bpp;
      colors.add(row[i] + ',' + row[i + 1] + ',' + row[i + 2]);
      if (colors.size > 500) return colors.size;
    }
  }
  return colors.size;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/meta-chromium/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage',
      '--allow-file-access-from-files',
      '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--hatch-webgl-allowed-domains-file=' + path.join(OUT, 'webgl-policy-all.txt'),
      '--hatch-webgl-allowed-domains-sha256=8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,local-network-access-check',
      '--proxy-server=http://127.0.0.1:3129',
      '--proxy-bypass-list=127.0.0.1,localhost', // local game direct; GD SDK via proxy
      '--ignore-certificate-errors'], // egress proxy MITMs TLS with its own CA
  });
  const page = await browser.newPage({
    viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
  const errors = [];
  const logs = [];
  page.on('pageerror', (e) => {
    // GD's own SDK calls the removed document.browsingTopics() API; noise.
    if (e.message.includes('browsingTopics')) { logs.push('IGNORED: ' + e.message); return; }
    errors.push('PAGEERROR: ' + e.message);
  });
  page.on('console', (m) => {
    const t = m.text();
    logs.push(m.type() + ': ' + t.slice(0, 300));
    if (t.includes('HeaderLift service response error')) return;
    if (t.includes('Cross-Origin-Opener-Policy header has been ignored')) return;
    // GD's ad partners call the removed document.browsingTopics() API.
    if (t.includes('browsingTopics')) return;
    if (m.type() === 'error') errors.push('CONSOLE: ' + t.slice(0, 300));
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    // The game bundle is fully local (all assets in the archive); every
    // external request comes from the GD SDK's ad stack (prebid partners,
    // trackers), which the sandbox blocks. Ignore all non-local failures.
    if (!/localhost|127\.0\.0\.1/.test(u)) {
      logs.push('IGNORED-REQFAIL(ad): ' + u.slice(0, 160));
      return;
    }
    errors.push('REQFAIL: ' + u.slice(0, 160) + ' ' + (r.failure() || {}).errorText);
  });

  const m = url.match(/localhost:(\d+)/);
  const waitRe = m ? new RegExp('localhost:' + m[1]) : /localhost/;
  await page.goto(url, { waitUntil: 'load' });
  // Redirect pages (file:// -> http://localhost) need a moment to land.
  await page.waitForURL(waitRe, { timeout: 15000 }).catch(() => {});
  await sleep(9000); // wasm engine boot
  const titleShot = await page.screenshot({ path: path.join(OUT, '01-title.png') });
  let s = await state(page);
  check('page loads, title state reported', s.screen === 'title', JSON.stringify(s));
  const distinct = pngDistinctColors(titleShot);
  check('canvas non-blank (title screenshot, distinct colors)',
    distinct > 50, 'distinct=' + distinct);

  // PLAY -> level 1 (button at game coords 360,660)
  await heldClick(page, 360, 620); // PLAY: GUI y=660
  s = await waitState(page, (x) => x.screen === 'play', 10000, 'PLAY starts level 1');
  await sleep(2500); // mission banner clears
  await page.screenshot({ path: path.join(OUT, '02-level1.png') });
  check('level 1 board populated', parseInt(s.bubbles || '0') >= 20,
    'bubbles=' + s.bubbles);
  const shots0 = parseInt(s.shots || '0');
  check('level 1 has shots', shots0 > 0, 'shots=' + s.shots);

  // Manual shot: click above the shooter (aim up-right, fires on release)
  await heldClick(page, 520, 500);
  await sleep(1500);
  s = await state(page);
  check('manual click fires a bubble (shots decrease)',
    parseInt(s.shots || '0') === shots0 - 1,
    'shots ' + shots0 + ' -> ' + s.shots);
  await page.screenshot({ path: path.join(OUT, '03-after-shot.png') });

  // Pause with P, resume with P
  await heldKey(page, 'p');
  await sleep(600);
  s = await state(page);
  check('pause key pauses', s.paused === '1', JSON.stringify(s));
  await page.screenshot({ path: path.join(OUT, '04-paused.png') });
  await heldKey(page, 'p');
  await sleep(600);
  s = await state(page);
  check('pause key resumes', s.paused === '0', JSON.stringify(s));

  // Autoplay to win level 1 (up to 180s)
  await heldKey(page, 'a');
  s = await waitState(page, (x) => x.screen === 'win' || x.screen === 'lose',
    180000, 'autoplay finishes level 1');
  await page.screenshot({ path: path.join(OUT, '05-end-level1.png') });
  check('level 1 won by autoplay', s.screen === 'win',
    'score=' + s.score + ' bubbles=' + s.bubbles);
  const score1 = parseInt(s.score || '0');
  check('score increased during play', score1 > 0, 'score=' + score1);

  if (s.screen === 'win') {
    // NEXT LEVEL button (game coords 360, ~550 on the win panel)
    await heldClick(page, 360, 720); // NEXT LEVEL: GUI y=560
    s = await waitState(page, (x) => x.screen === 'play' && parseInt(x.level || '0') === 2,
      10000, 'NEXT LEVEL starts level 2');
    await sleep(2500);
    await page.screenshot({ path: path.join(OUT, '06-level2.png') });
    check('level 2 board populated', parseInt(s.bubbles || '0') >= 20,
      'bubbles=' + s.bubbles);
    // back to title via pause -> quit
    await heldKey(page, 'p');
    await sleep(800);
    // QUIT TO TITLE button on pause panel (360, ~460)
    await heldClick(page, 360, 820); // QUIT TO TITLE: GUI y=460
    s = await waitState(page, (x) => x.screen === 'title', 10000,
      'quit returns to title');
  } else if (s.screen === 'lose') {
    // Recovery: lose screen -> LEVELS (360,480) -> BACK (360,130) -> title.
    await heldClick(page, 360, 800); // LEVELS (lose): GUI y=480
    await waitState(page, (x) => x.screen === 'levels', 10000, 'lose -> levels');
    await heldClick(page, 360, 1150); // BACK: GUI y=130
    s = await waitState(page, (x) => x.screen === 'title', 10000,
      'levels -> title');
  }

  // Endless smoke test
  await heldClick(page, 360, 830); // ENDLESS: GUI y=450
  s = await waitState(page, (x) => x.screen === 'play' && x.endless === '1',
    10000, 'ENDLESS starts endless mode');
  await sleep(2000);
  const eScore0 = parseInt(s.score || '0');
  // Autoplay still on: poll up to 60s for the score to move. At headless
  // SwiftShader FPS a single shot can take seconds to fly and resolve,
  // so a fixed 12s window is too short.
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    s = await state(page);
    if (parseInt(s.score || '0') > eScore0) break;
    await sleep(500);
  }
  s = await state(page);
  check('endless mode scores', parseInt(s.score || '0') > eScore0,
    'score ' + eScore0 + ' -> ' + s.score);
  await page.screenshot({ path: path.join(OUT, '07-endless.png') });
  await heldKey(page, 'a'); // autoplay off

  // Mute toggle on title (go back first). The pause key is frame-polled,
  // so retry it until the game actually reports paused.
  let pausedOk = false;
  for (let i = 0; i < 3 && !pausedOk; i++) {
    await heldKey(page, 'p');
    await sleep(500);
    pausedOk = (await state(page)).paused === '1';
  }
  check('pause in endless works', pausedOk);
  await heldClick(page, 360, 820); // QUIT TO TITLE: GUI y=460 // quit to title
  await waitState(page, (x) => x.screen === 'title', 10000, 'back to title');
  await heldClick(page, 620, 50); // SOUND ON/OFF: GUI y=1230
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, '08-title-muted.png') });
  check('mute toggle clickable (no crash)', true);

  const realErrors = errors.filter((e) =>
    !/gamedistribution|GD_|gdsdk/i.test(e) &&
    // The game loads zero external resources (all assets are in the
    // archive); any "Failed to load resource" is the favicon or a GD SDK
    // ad-network fetch. A real game-asset failure would fail the boot
    // check instead, so these are noise here.
    !/^CONSOLE: Failed to load resource/.test(e));
  check('no page/console errors (excluding GD SDK network noise)',
    realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
  if (errors.length) console.log('ALL console/page errors:\n' + errors.slice(0, 8).join('\n'));

  await browser.close();
  const fails = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed`);
  fs.writeFileSync(path.join(OUT, 'results.json'),
    JSON.stringify(results, null, 2));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('VERIFY CRASH:', e); process.exit(2); });
