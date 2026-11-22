// Bloom Bubbles — spot-check every curve-v2 changed level
// (4, 6, 7, 9, 10, 12, 13, 15, 16, 18, 20) via the U debug unlock.
// Usage: node verify/spot-check-levels.js
// Loads via verify/redirect.html, presses U on the title screen (hidden QA
// aid: unlocks all levels in memory, session-only), opens the level-select
// screen, picks the target level, autoplays with the bot (A), up to 3
// attempts per level. Results land in verify/results-spot.json and are
// merged into verify/results-levels.json under "spotCheck" (progression
// data preserved).
//
// Coordinates: GUI origin bottom-left, page origin top-left:
// page y = 1280 - gui y. Level tiles: x = 120 + col*160,
// y = 1010 - row*190 (col = (i-1)%4, row = floor((i-1)/4)).
const { chromium } = require('/home/hatch/workspace/tools/pw-shot/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const GAME_URL = 'file:///home/hatch/workspace/defold/projects/bloom-bubbles/verify/redirect.html';
const TARGETS = [7, 9, 10, 12, 13, 15, 16, 18, 20]; // curve v2.1 re-test set (adjusted levels)
const MAX_ATTEMPTS = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tilePageXY(i) {
  const col = (i - 1) % 4;
  const row = Math.floor((i - 1) / 4);
  const gx = 120 + col * 160;
  const gy = 1010 - row * 190;
  return [gx, 1280 - gy];
}
async function heldClick(page, x, y, holdMs) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await sleep(holdMs || 800);
  await page.mouse.up();
  await sleep(300);
}
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
async function waitStateLog(page, pred, timeoutMs, label) {
  const t0 = Date.now();
  let lastLog = 0;
  while (Date.now() - t0 < timeoutMs) {
    const s = await state(page);
    if (pred(s)) return { state: s, ok: true };
    if (Date.now() - lastLog > 20000) {
      lastLog = Date.now();
      console.log('  ... waiting ' + label + ' ' + Math.round((Date.now() - t0) / 1000) + 's last=' + JSON.stringify(s));
    }
    await sleep(1000);
  }
  const s = await state(page);
  console.log('TIMEOUT ' + label + ' last=' + JSON.stringify(s));
  return { state: s, ok: false };
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
      '--proxy-bypass-list=127.0.0.1,localhost',
      '--ignore-certificate-errors'],
  });
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => { errors.push('PAGEERROR: ' + e.message); });

  const spot = [];
  for (const level of TARGETS) {
    console.log(`=== spot-check level ${level} ===`);
    // Fresh boot per level (win/lose panel navigation avoided; the U
    // unlock is session-only so it is re-applied after every reload).
    await page.goto(GAME_URL, { waitUntil: 'load' });
    await page.waitForURL(/localhost:8901/, { timeout: 15000 }).catch(() => {});
    await sleep(12000);
    let s = await state(page);
    if (s.screen !== 'title') {
      console.log('level ' + level + ': title not reached, last=' + JSON.stringify(s));
      spot.push({ level, won: false, attempts: 0, error: 'title not reached: ' + JSON.stringify(s) });
      continue;
    }
    // U = debug unlock (title screen only).
    await heldKey(page, 'u');
    await sleep(500);
    // LEVELS button: GUI (360,540) -> page (360,740).
    await heldClick(page, 360, 740);
    let r = await waitStateLog(page, (x) => x.screen === 'levels', 15000, 'level select opens');
    if (!r.ok) {
      spot.push({ level, won: false, attempts: 0, error: 'level select did not open' });
      continue;
    }
    const [tx, ty] = tilePageXY(level);
    await heldClick(page, tx, ty);
    r = await waitStateLog(page, (x) => x.screen === 'play' && parseInt(x.level || '0') === level, 15000, 'level ' + level + ' starts');
    if (!r.ok) {
      spot.push({ level, won: false, attempts: 0, error: 'level tile did not start level (still locked?) last=' + JSON.stringify(r.state) });
      continue;
    }
    await sleep(2500); // mission banner clears
    await heldKey(page, 'a');
    await sleep(500);
    s = await state(page);
    console.log('level ' + level + ' started, bot auto=' + s.auto + ' bubbles=' + s.bubbles + ' shots=' + s.shots);

    let won = false;
    let lastState = null;
    let attemptsUsed = 0;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !won; attempt++) {
      attemptsUsed = attempt;
      console.log(`--- level ${level} attempt ${attempt}/${MAX_ATTEMPTS} ---`);
      r = await waitStateLog(page, (x) => x.screen === 'win' || x.screen === 'lose', 420000, `level ${level} finishes`);
      lastState = r.state;
      if (!r.ok) { console.log('level ' + level + ' timed out'); break; }
      if (r.state.screen === 'win') { won = true; break; }
      console.log('level ' + level + ' LOST (score=' + r.state.score + ' bubbles=' + r.state.bubbles + '), retrying via TRY AGAIN');
      if (attempt < MAX_ATTEMPTS) {
        // TRY AGAIN on lose panel: GUI y=570 -> page 710.
        await heldClick(page, 360, 710);
        const rr = await waitStateLog(page, (x) => x.screen === 'play' && parseInt(x.level || '0') === level, 15000, 'level ' + level + ' restarts');
        if (!rr.ok) { console.log('restart failed'); break; }
        await sleep(2500);
      }
    }
    const entry = {
      level, won, attempts: attemptsUsed,
      score: lastState ? parseInt(lastState.score || '0') : null,
      shotsLeft: lastState ? parseInt(lastState.shots || '0') : null,
      bubblesLeft: lastState ? parseInt(lastState.bubbles || '0') : null,
    };
    console.log(`LEVEL ${level}: ${won ? 'WIN' : 'LOSE'} score=${entry.score} shots=${entry.shotsLeft} bubbles=${entry.bubblesLeft}`);
    spot.push(entry);
  }

  await browser.close();
  const summary = { date: new Date().toISOString(), via: 'U debug unlock + level select + autoplay bot', spotCheck: spot };
  fs.writeFileSync(path.join(OUT, 'results-spot.json'), JSON.stringify(summary, null, 2));
  // Merge into results-levels.json (preserving the progression record).
  try {
    const progPath = path.join(OUT, 'results-levels.json');
    const prog = JSON.parse(fs.readFileSync(progPath, 'utf8'));
    prog.spotCheck = spot;
    prog.spotCheckDate = summary.date;
    fs.writeFileSync(progPath, JSON.stringify(prog, null, 2));
    console.log('merged spotCheck into results-levels.json');
  } catch (e) {
    console.log('could not merge into results-levels.json: ' + e.message);
  }
  console.log('spot-check: ' + JSON.stringify(spot));
  const lost = spot.filter((x) => !x.won).length;
  process.exit(lost ? 1 : 0);
})().catch((e) => { console.error('SPOT CHECK CRASH:', e); process.exit(2); });
