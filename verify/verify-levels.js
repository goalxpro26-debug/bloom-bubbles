// Bloom Bubbles — level-progression + GD SDK verification (Nov 22, 2026).
// Usage: node verify-levels.js
// Loads the game via verify/redirect.html (file:// -> http://localhost:8901),
// records GD SDK presence evidence, then autoplays levels 1..20 linearly
// with the in-game bot (A), NEXT LEVEL after each win, at least to level 13
// (with a manual-shot check there), then 16 and 20 if reachable.
// Screenshots + results-levels.json + console-sdk.log land in verify/.
//
// INPUT NOTE: same held-input rules as verify.js (Defold polls input once
// per engine frame; headless SwiftShader runs at a few FPS). GUI coords are
// bottom-left origin; page coords are top-left: page y = 1280 - gui y.
const { chromium } = require('/home/hatch/workspace/tools/pw-shot/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const GAME_URL = 'file:///home/hatch/workspace/defold/projects/bloom-bubbles/verify/redirect.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  [' + detail + ']' : ''));
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
// Wait for a state predicate, logging progress every 20s. Returns {state, ok}.
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
  const logs = [];
  const failedReqs = [];
  page.on('pageerror', (e) => { errors.push('PAGEERROR: ' + e.message); logs.push('pageerror: ' + e.message); });
  page.on('console', (m) => { logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  page.on('requestfailed', (r) => { failedReqs.push(r.url() + ' :: ' + (r.failure() || {}).errorText); });
  page.on('response', (r) => { if (r.status() >= 400) failedReqs.push(r.url() + ' :: HTTP ' + r.status()); });

  await page.goto(GAME_URL, { waitUntil: 'load' });
  await page.waitForURL(/localhost:8901/, { timeout: 15000 }).catch(() => {});
  await sleep(12000); // wasm engine boot + GD SDK script fetch window

  // ---- SDK CHECKS ----
  const sdk = await page.evaluate(() => ({
    gdsdk: typeof window.gdsdk,
    gdsdkShowAd: (typeof window.gdsdk !== 'undefined' && typeof window.gdsdk.showAd),
    GD_OPTIONS: typeof window.GD_OPTIONS,
    GD_OPTIONS_gameId: (typeof window.GD_OPTIONS !== 'undefined' ? window.GD_OPTIONS.gameId : null),
    GD_DEFOLD: typeof window.GD_DEFOLD,
    GD_DEFOLD_onEvent: (typeof window.GD_DEFOLD !== 'undefined' ? typeof window.GD_DEFOLD.onEvent : null),
  }));
  const sdkReadyLogs = logs.filter((l) => /SDK_READY|SDK_GAME_START|SDK_GAME_PAUSE|SDK_ERROR|gdsdk/i.test(l));
  const sdkLog = [
    'Bloom Bubbles GD SDK evidence — ' + new Date().toISOString(),
    'served from http://localhost:8901 (serve-coop.py, COOP same-origin + COEP require-corp)',
    '',
    'window.gdsdk: ' + sdk.gdsdk,
    'window.gdsdk.showAd: ' + sdk.gdsdkShowAd,
    'window.GD_OPTIONS: ' + sdk.GD_OPTIONS,
    'window.GD_OPTIONS.gameId: ' + JSON.stringify(sdk.GD_OPTIONS_gameId),
    'window.GD_DEFOLD: ' + sdk.GD_DEFOLD,
    'window.GD_DEFOLD.onEvent: ' + sdk.GD_DEFOLD_onEvent,
    '',
    'console lines mentioning SDK/gdsdk (' + sdkReadyLogs.length + '):',
    ...sdkReadyLogs,
    '',
    'failed requests / HTTP>=400 (' + failedReqs.length + '):',
    ...failedReqs,
    '',
    'ALL console lines (' + logs.length + '):',
    ...logs,
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'console-sdk.log'), sdkLog);
  check('SDK: window.gdsdk present', sdk.gdsdk !== 'undefined', 'typeof=' + sdk.gdsdk);
  check('SDK: window.GD_OPTIONS present with gameId 07955f6876a044aba4887d68e84123ca',
    sdk.GD_OPTIONS !== 'undefined' && sdk.GD_OPTIONS_gameId === '07955f6876a044aba4887d68e84123ca',
    'gameId=' + JSON.stringify(sdk.GD_OPTIONS_gameId));
  check('SDK: window.GD_DEFOLD present with onEvent',
    sdk.GD_DEFOLD !== 'undefined' && sdk.GD_DEFOLD_onEvent === 'function',
    'typeof=' + sdk.GD_DEFOLD + ' onEvent=' + sdk.GD_DEFOLD_onEvent);
  check('SDK: SDK_READY (or equivalent init event) in console',
    sdkReadyLogs.some((l) => /SDK_READY/i.test(l)),
    sdkReadyLogs.length ? sdkReadyLogs.slice(0, 3).join(' | ') : 'no SDK lines in console');

  // ---- LEVEL PROGRESSION ----
  let s = await state(page);
  check('title screen ready for progression run', s.screen === 'title', JSON.stringify(s));
  await heldClick(page, 360, 620); // PLAY: GUI y=660
  let r = await waitStateLog(page, (x) => x.screen === 'play' && parseInt(x.level || '0') === 1, 15000, 'level 1 starts');
  check('level 1 starts', r.ok, JSON.stringify(r.state));
  await sleep(2500); // mission banner clears

  // Bot on.
  await heldKey(page, 'a');
  await sleep(500);
  s = await state(page);
  check('autoplay bot toggles on', s.auto === '1', 'auto=' + s.auto);

  const perLevel = [];
  let highestReached = 1;
  let level20Attempts = 0;
  let stopReason = 'completed all 20 levels';
  for (let level = 1; level <= 20; level++) {
    highestReached = level;
    const tries = (level === 20) ? 3 : 5;
    let won = false;
    let lastState = null;
    let attemptsUsed = 0;
    for (let attempt = 1; attempt <= tries && !won; attempt++) {
      attemptsUsed = attempt;
      console.log(`--- level ${level} attempt ${attempt}/${tries} ---`);
      r = await waitStateLog(page, (x) => x.screen === 'win' || x.screen === 'lose', 420000, `level ${level} finishes`);
      lastState = r.state;
      if (!r.ok) { console.log('level ' + level + ' timed out, aborting run'); break; }
      if (r.state.screen === 'win') { won = true; break; }
      // lose: TRY AGAIN (panel centre 640, offset -70 -> GUI y=570 -> page 710)
      console.log('level ' + level + ' LOST (score=' + r.state.score + '), retrying via TRY AGAIN');
      if (attempt < tries) {
        await heldClick(page, 360, 710);
        const rr = await waitStateLog(page, (x) => x.screen === 'play' && parseInt(x.level || '0') === level, 15000, 'level ' + level + ' restarts');
        if (!rr.ok) { console.log('restart failed, aborting'); break; }
        await sleep(2500);
      }
    }
    if (level === 20) level20Attempts = attemptsUsed;
    perLevel.push({ level, won, attempts: attemptsUsed, score: lastState ? parseInt(lastState.score || '0') : null, shotsLeft: lastState ? parseInt(lastState.shots || '0') : null, bubblesLeft: lastState ? parseInt(lastState.bubbles || '0') : null });
    console.log(`LEVEL ${level}: ${won ? 'WIN' : 'LOSE'} score=${lastState && lastState.score} shots=${lastState && lastState.shots} bubbles=${lastState && lastState.bubbles}`);
    if (!won) { stopReason = 'bot could not win level ' + level + ' after ' + tries + ' attempt(s)'; break; }

    if (level === 13) {
      // Level 13 was just won; screenshot was taken at its start below.
      // (manual-shot check ran when level 13 loaded, see below)
    }
    if (level === 20) break;
    // NEXT LEVEL (win panel centre 640, offset -80 -> GUI y=560 -> page 720)
    let advanced = false;
    for (let i = 0; i < 3 && !advanced; i++) {
      await heldClick(page, 360, 720);
      const rr = await waitStateLog(page, (x) => x.screen === 'play' && parseInt(x.level || '0') === level + 1, 20000, 'level ' + (level + 1) + ' starts');
      advanced = rr.ok;
      if (advanced) lastState = rr.state;
    }
    check('NEXT LEVEL starts level ' + (level + 1), advanced, advanced ? JSON.stringify(lastState) : 'stayed on win screen');
    if (!advanced) { stopReason = 'NEXT LEVEL failed after level ' + level; break; }
    await sleep(2500); // mission banner clears
    s = await state(page);
    if (level + 1 === 13) {
      await page.screenshot({ path: path.join(OUT, '09-level13.png') });
      check('level 13 board populated', parseInt(s.bubbles || '0') >= 50, 'bubbles=' + s.bubbles);
      // Manual shot on level 13: bot off, click, shots must decrease, bot on.
      await heldKey(page, 'a');
      await sleep(500);
      s = await state(page);
      const botOff = s.auto === '0';
      const shotsBefore = parseInt(s.shots || '0');
      await heldClick(page, 520, 500);
      await sleep(1500);
      s = await state(page);
      check('level 13 manual shot fires (bot off)', botOff && parseInt(s.shots || '0') === shotsBefore - 1,
        'auto=' + s.auto + ' shots ' + shotsBefore + ' -> ' + s.shots);
      await heldKey(page, 'a');
      await sleep(500);
      s = await state(page);
      check('bot re-enabled on level 13', s.auto === '1', 'auto=' + s.auto);
    }
    if (level + 1 === 16) {
      await page.screenshot({ path: path.join(OUT, '10-level16.png') });
      check('level 16 board populated (~70 bubbles)', parseInt(s.bubbles || '0') >= 60, 'bubbles=' + s.bubbles);
    }
    if (level + 1 === 20) {
      await page.screenshot({ path: path.join(OUT, '11-level20.png') });
      check('level 20 board populated', parseInt(s.bubbles || '0') >= 60, 'bubbles=' + s.bubbles);
    }
  }
  if (highestReached === 20 && perLevel[19] && perLevel[19].won) {
    await page.screenshot({ path: path.join(OUT, '12-level20-win.png') });
  }

  const realErrors = errors.filter((e) => !/gamedistribution|GD_|gdsdk|browsingTopics/i.test(e) && !/^CONSOLE: Failed to load resource/.test(e));
  check('no page errors during progression (excluding GD noise)', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  await browser.close();
  const summary = {
    date: new Date().toISOString(),
    highestLevelReached: highestReached,
    stopReason,
    perLevel,
    checks: results,
  };
  fs.writeFileSync(path.join(OUT, 'results-levels.json'), JSON.stringify(summary, null, 2));
  const fails = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed; highest level reached: ${highestReached} (${stopReason})`);
  console.log('per-level: ' + JSON.stringify(perLevel));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('LEVELS VERIFY CRASH:', e); process.exit(2); });
