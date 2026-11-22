# Bloom Bubbles — GameDistribution (HTML5) notes

## Status
- SDK: gd-defold (https://github.com/GameDistribution/gd-defold, main branch),
  vendored locally under `gamedistribution/` (upstream folder, verbatim) with
  `[library] include_dirs = gamedistribution` in `game.project`. The URL
  dependency line was removed: bob cannot fetch the zip through the egress
  proxy (see Toolchain traps below).
- `[gamedistribution] game_id = "PLACEHOLDER"` — the parent fills the real HEX
  Game ID from the portal Upload tab before upload. The bundle's index.html
  already carries `GD_OPTIONS` (verified present in `dist/html5/Bloom Bubbles/`).
- Game: original garden bubble shooter, Defold 1.14.0. **20 levels** with
  missions (clear the board, pop N of one colour, reach a score target),
  1–3 stars per level by shots left, progress saved; plus an endless
  score-attack mode with a saved best score. 6 bubble colours, a new row
  drops in every few shots, red danger line. Controls: mouse (hover to aim,
  click to shoot), touch (drag to aim, release to shoot), keyboard (arrows
  aim, Space shoots, P pauses). Hidden verification aids: press **A** to
  toggle an auto-play bot; press **U** on the title screen to unlock all
  levels in memory for the session (QA aid, not a player feature — see
  Verification, Nov 22 run 4).
- Audio: 9 synthesized SFX + 2 music loops, all generated locally by
  `tools/synth_audio.py` (numpy, no AI audio, no downloads). Art: all
  sprites drawn in code by `tools/make_art.py` (PIL, no AI images, no
  copied assets).

## Ads
- `main/game.script` wraps `gdsdk` with pcall guards (`if gdsdk then ...
  pcall(...) end`), so the game runs fine with no SDK / no network.
  Listener registered in `init()` via `pcall(gdsdk.set_listener, ...)`.
- Pre-roll interstitial on the **first Play tap only** (`ui_play`, gated by
  the saved `played_once` flag, persisted so it fires once ever). Never on
  load, never on a timer.
- Interstitial when the player taps **Next** on a level-complete screen
  (`ui_next` -> `show_ad`).
- `SDK_GAME_PAUSE` sets `self.ad_paused`, mutes audio
  (`audio.set_muted(true)`) and posts `gd_pause` to the GUI, which sets
  `self.paused = true` and blocks gameplay input. `SDK_GAME_START` clears
  the ad pause, restores the player's own mute preference
  (`audio.set_muted(self.muted)`) and posts `gd_resume`, which restores
  `paused` to the user's own pause state (`self.user_paused or false`).
  No explicit SDK_ERROR/AD_ERROR handler: if an ad fails, the SDK fires
  SDK_GAME_START on the failure path (same as Pocket Escape's behaviour);
  if a failed ad ever left the game paused, that would be a portal-side
  SDK behaviour to report, not a game-side fix.

## Animations
- `main/gui.gui_script` — pop bursts, falling clusters, combo score
  popups (`+pts`, `COMBO xN`, falling bonus), shooter recoil (scale
  squash on fire), aim guide dots, tweened panels (`gui.animate` scale
  pops on title/level-complete/star nodes, button press squash), win
  confetti (spawned on level win and on mission complete), mission banner
  slide-in, bubble flight + stick + drop tweens (position/scale
  `gui.animate`). All tweens are callback-free where nodes can be deleted
  mid-tween.

## Rebuild
Use the exact command from the project README.md (extender reverse proxy
on 127.0.0.1:8080 + egress truststore + run-bob.sh wasm-web build+bundle):

```bash
# start the extender reverse proxy (once per VM boot)
setsid nohup python3 ~/workspace/tools/extender-reverse-proxy.py \
  >/tmp/extender-rproxy.log 2>&1 &
cd ~/workspace/defold/projects/bloom-bubbles
export JAVA_TOOL_OPTIONS="-Djava.net.preferIPv4Stack=true \
  -Djavax.net.ssl.trustStore=$HOME/workspace/tools/egress-truststore.jks \
  -Djavax.net.ssl.trustStorePassword=changeit"
~/workspace/defold/run-bob.sh --build-server http://127.0.0.1:8080 \
  --platform wasm-web --variant release --archive \
  --bundle-output dist/html5 resolve build bundle
# -> dist/html5/Bloom Bubbles/
```

HTML5 platform is `wasm-web` (not `js-web`). Engine artifacts are
pre-seeded in `~/workspace/defold/bob-root/wasm_pthread-web/`.
Thumbnails for the portal live in `dist/gd-upload/` (see
`docs/gd-listing.md`); regenerate them from `verify/01-title.png` if the
title art changes.

## Verification (Nov 22, 2026)
- `verify/verify.js` against the GD bundle (`dist/html5/Bloom Bubbles/`,
  served on localhost:8901) — **14/14 checks passed**,
  `verify/results.json`. Title loads, canvas non-blank (501 distinct
  colours in the title screenshot), PLAY starts level 1 (30 bubbles,
  35 shots), manual shot fires (35 -> 34), pause/resume via P,
  autoplay wins level 1 (score 1250, board cleared, 21 shots left),
  NEXT LEVEL starts level 2 (50 bubbles), endless mode scores
  (0 -> 40), pause in endless, mute toggle, no page/console errors
  (excluding GD SDK ad-network noise).
- The game reports live state in `document.title`
  (`BLOOM|screen=...|score=...|bubbles=...|shots=...|...`) which the
  verify script polls. Screenshots land in `verify/` (`01-title.png`
  through `08-title-muted.png`).
- Re-run: the README build command above, then (from
  `dist/html5/"Bloom Bubbles"`) `python3 -m http.server 8901 &` and
  `node verify/verify.js http://127.0.0.1:8901/index.html`.
  (`verify/serve-coop.py` is an alternative server with COOP/COEP
  headers if the pthread wasm build ever needs them; the 14/14 run
  used the plain `http.server`.)

## Verification — 20-level rebuild (Nov 22, 2026, ~18:00–18:35 PST)
- **Rebuild**: bob exit code **0**; `dist/html5/Bloom Bubbles/` rebuilt
  (8.4 MB, `index.html` present, `GD_OPTIONS` with
  `gameId: "PLACEHOLDER"`). Truststore was current (hatch-egress-ca
  SHA-256 fingerprint matched the live CA bundle, no rebuild needed);
  extender reverse proxy on 127.0.0.1:8080 was already running.
  `main/levels.lua` confirmed at 20 entries before building.
- **verify.js re-run (20-level build): 14/14 checks passed**,
  `verify/results.json` overwritten with the new run. Served with
  `verify/serve-coop.py` on port 8901 (COOP same-origin + COEP
  require-corp) and loaded via `verify/redirect.html` (file:// page
  that navigates to http://localhost:8901 — required because this
  Chrome 157 build blocks CDP-initiated navigation to loopback with
  `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS` no matter the flags;
  see the comment in `redirect.html`). One harness tweak:
  `--proxy-bypass-list=127.0.0.1,localhost` added to the Chrome launch
  args in `verify.js` so the local game loads direct while the GD SDK
  still goes through the 127.0.0.1:3129 egress forward proxy.
  Screenshots `01-title.png`–`08-title-muted.png` refreshed 18:06–18:07.
  Only console noise: the COEP-blocked GD SDK script (see SDK below)
  plus two `/favicon.ico` 404s (no favicon ships in the bundle —
  harmless).
- **GD SDK checks** (`verify/verify-levels.js` + `verify/console-sdk.log`):
  under the COOP/COEP server, `window.GD_OPTIONS` present with
  `gameId "PLACEHOLDER"` (TRUE) and `window.GD_DEFOLD` present with
  `onEvent` a function (TRUE), but `window.gdsdk` was `undefined`
  (FALSE) and no `SDK_READY` appeared in console (FALSE) — because
  COEP `require-corp` blocks the cross-origin SDK script:
  `https://html5.api.gamedistribution.com/main.min.js ::
  net::ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep`.
  Re-probed the **same bundle under plain `http.server` (no COEP)**:
  all four TRUE — `window.gdsdk: object`,
  `window.gdsdk.showAd: function`, `window.GD_OPTIONS.gameId:
  "PLACEHOLDER"`, `window.GD_DEFOLD.onEvent: function`, and console
  shows `GameDistribution.com HTML5 SDK | Version: 1.43.63`,
  `{name: SDK_READY, ...}`, `INFO:GameDistribution:
  GameDistribution_OnEventListener SDK_READY msg: Everything is ready.`
  and `DEBUG:SCRIPT: GD event\tSDK_READY\tEverything is ready.`
  (plus the expected `Loader frame does not exist ... Game Id check is
  not possible` outside the portal iframe). **Conclusion: the SDK
  integration is correct; the COEP-server failure is a harness
  artifact — the GD portal serves the game without COEP, so the SDK
  loads there. Do not "fix" this by changing the game; serve without
  COEP when the SDK needs to load.**
- **Level progression** (`verify/verify-levels.js`,
  `verify/results-levels.json`): autoplay bot won level 1 (score 1640,
  21 shots left, board cleared) and level 2 (score 1300, 17 shots
  left), then **lost level 3 seven times in a row across two runs**
  (scores 1950, 2450, 2450, 2660, 2620, 1950, 2450 vs target 3000;
  best 2660 = 89% of target). **Highest level reached: 3. Levels 4–20
  were NOT autoplay-verified** — no `09-level13.png` / `10-level16.png`
  / `11-level20.png` exist, and **level 20's score target was NOT
  changed** (never reached, so no evidence justified it).
  Root-cause note: level 3 is a score mission (5 rows, 4 colours,
  28 shots, "Score 3,000 points") and the win check is correct
  (`check_end`: `score >= target`, checked after every shot). The bot
  is combo-blind — its aim model scores `cluster*10 + drops*15` and
  ignores the real combo bonus (`10*cluster + 50*(combo-1)` per pop,
  +20 per dropped bubble), and every setup shot resets the combo to 0.
  A decent human chaining combos can plausibly clear 3000, so this is
  a bot-limitation signal, not a proven level defect — but it is a
  real difficulty flag for the earliest score mission. **Coordinator
  decision needed before re-running progression: (a) lower level 3's
  target (e.g. to 2500), (b) teach the bot combo awareness, or (c)
  accept level 3 as bot-unverified and verify 4–20 another way.**
  Until then, do not claim levels 4–20 are verified.

## Verification — level 3 retune + progression re-run (Nov 22, 2026, ~18:33–18:50 PST)
- **Level 3 change** (`main/levels.lua` only): score target **3000 → 2500**,
  text "Score 3,000 points" → "Score 2,500 points". Rationale: the bot's
  best across the previous 7 attempts was 2660 (89% of 3000), and level 3
  is an early level that should be forgiving; humans chaining combos can
  beat 2500 comfortably. No other level, mission type, or file touched.
- **Rebuild**: bob exit code **0**; `dist/html5/Bloom Bubbles/` rebuilt
  18:33 (extender reverse proxy already running on 127.0.0.1:8080;
  truststore current, rebuilt 17:33, newer than the CA bundle). Note:
  the old `serve-coop.py` on 8901 was serving a deleted bundle dir
  (curl returned 000) — killed it and restarted the server from the
  fresh bundle dir before verifying.
- **Level progression** (`verify/verify-levels.js`,
  `verify/results-levels.json`, 9/11 checks passed — the 2 fails are the
  known COEP-server SDK artifact, `window.gdsdk` undefined / no
  `SDK_READY`, already proven 4/4 true under a plain server):
  level 1 WIN attempt 1 (score 1640, 21 shots left, board cleared);
  level 2 WIN attempt 1 (score 2280, 13 shots left, 5 bubbles left);
  **level 3 WIN attempt 3 (score 2570, 5 shots left, 8 bubbles left)** —
  attempts 1–2 lost at 2060 and 1950, so the 2500 target is reachable by
  the bot but not a gimme. **Highest level reached: 4.**
- **Level 4 STALLED — tuning defect, no trim applied.** Clear mission,
  6 rows / 4 colours / 26 shots ("Clear all the bubbles!"). Bot lost all
  5 attempts: scores 1880, 2000, 2000, 1310, 1310; final attempt ended
  0 shots, **64 bubbles left**. Mechanics (verified in code): a new
  10-bubble row drops every 6 shots while the board holds > 12 bubbles,
  so up to 100 bubbles are presented in 26 shots (~3.8 pops/shot needed
  to clear); the bot averages ~1.4 pops/shot. A +2-shots trim would add
  ~3 pops against a 64-bubble gap, so no trim was made — trimming cannot
  fix this and the task rule says report, don't trim. Additional evidence
  the 5 attempts are not independent: the board layout is FIXED per
  level (`seed = level * 7919 + 13` in `gui.gui_script:381`), so retries
  replay the same layout (identical scores 2000/2000 and 1310/1310).
  This is a difficulty spike at level 4 of 20, not a code bug — the win
  check (`board.count == 0`) and lose checks work correctly. Coordinator
  decision needed: retune level 4 (fewer rows / more shots / later
  first clear), teach the bot combo/drop awareness, or verify 5–20
  another way (e.g. a debug level-jump). **Levels 5–20 remain
  UNVERIFIED** — progression stops at the first unwinnable level, so no
  `09-level13.png` / `10-level16.png` / `11-level20.png` exist yet.
  Do not claim levels 5–20 are verified.

## Verification — level 4 retune + bot combo awareness + progression re-runs (Nov 22, 2026, ~18:53–19:28 PST)
- **Level 4 change** (`main/levels.lua` only): **6 rows / 26 shots →
  5 rows / 30 shots** (colors stay 4, mission stays "clear", text
  unchanged). Rationale: the old layout presented ~100 bubbles in
  26 shots (~3.8 pops/shot needed) against a bot averaging ~1.4.
- **Bot improvement** (`main/gui.gui_script`, autoplay scoring only —
  no game rules, scoring, or board logic touched): the bot now scores
  candidate shots with the real formula (10 per popped bubble, +50 per
  combo step beyond the first, +20 per dropped bubble, instead of the
  old `cluster*10 + drops*15`), charges a setup (non-pop) shot the
  combo bonus it destroys (`-50 * combo`), rewards pops that leave a
  ready group (size ≥ 2) of the next loaded colour on the board
  (+4 per bubble), and rewards setup shots that land next to a bubble
  of the next loaded colour (+12 per adjacent one, max 2) so the next
  shot can complete a pair. The best-score initializer was lowered to
  -1e9 so a negative-scoring setup is still chosen over a blind
  straight-up shot. The bot is a hidden verification aid (A key); the
  shipped player experience is unchanged.
- **Rebuilds**: bob exit code **0** twice (18:53 and 19:16);
  `dist/html5/Bloom Bubbles/` rebuilt (8.4 MB). The egress CA rotated
  between the two builds (bundle rewritten 19:03) — the truststore was
  rebuilt first (fingerprint now 3D:6A:96:23:… matching the live CA)
  before the second build. Extender reverse proxy on 127.0.0.1:8080
  restarted after a VM/runtime restart mid-run (see below).
- **Run 2 (18:53 build, killed by a runtime restart, partial
  evidence only — its /tmp log was wiped, no log survives)**: level 1
  WIN attempt 1 (1330, 12 shots left, board cleared), level 2 WIN
  attempt 1 (1980, 12 shots left), level 3 WIN attempt 1 (2750 vs
  2500 target, 2 shots left); level 4 attempt 1 LOST (2010), attempt
  2 LOST (3220), attempt 3 in progress when the restart killed the
  run; `results-levels.json` was never overwritten. **This run does
  not count as the completed progression run** — it was re-run in
  full afterwards (run 2b below).
- **Run 2b (same 18:53 build, `verify/run2.log` on disk) — completed
  19:04–19:16, 8/10 checks passed** (2 fails = the known COEP-server
  SDK artifact, `window.gdsdk` undefined / no `SDK_READY`, already
  proven 4/4 true under a plain server): level 1 WIN attempt 1 (1330,
  12 shots left, board cleared); level 2 WIN attempt 1 (1980, 12 shots
  left, 14 bubbles left); **level 3 STALLED — all 5 attempts lost at
  exactly 2300 (92% of the 2500 target), 0 shots, 32 bubbles left**.
  Note the bot is timing-sensitive: identical 2300s within this run,
  but 2750 (win) on the killed run and 2570 (win) the run before —
  the flying-bubble flight integrates per-frame dt, so landing cells
  vary run to run. 2300 ≥ 85% of target, so the one permitted small
  trim was applied to level 3 (see below). **Highest level reached: 3.**
- **Level 3 trim (the one permitted trim)**: score target **2500 →
  2200 (a 12% cut, within the 15% cap)**, text "Score 2,500 points" →
  "Score 2,200 points". Rationale: the bot's observed floor across
  this run was 2300 in all 5 attempts, and +2 shots (≈ +164 points at
  the bot's ~82 pts/shot) would likely still fall short of 2500,
  while −1 row would reduce score potential. 2200 sits below the bot's
  floor with margin while still requiring real combo play.
- **Run 3 — retry (19:16 build, `verify/run3.log`) — completed
  19:17–19:28, 9/11 checks passed** (2 fails = the same known COEP
  SDK artifact): level 1 WIN attempt 1 (1300, 16 shots left, board
  cleared); level 2 WIN attempt 1 (1940, 12 shots left, 13 bubbles
  left); **level 3 WIN attempt 1 (2270 vs 2200 target, 3 shots left,
  32 bubbles left)** — the trim worked, though with only 70 points
  of margin; **level 4 STALLED again — all 5 attempts lost, scores
  3560, 2980, 3160, 2800, 3560; final attempt ended 0 shots,
  9 bubbles left**. **Highest level reached: 4.**
- **Level 4 verdict — still stalled, but now very close, no trim
  applied.** The retune + bot work moved level 4 from 64 bubbles left
  (previous run) to **9 bubbles left** on the final attempt (~10% of
  the ~90 bubbles presented — within the ~15% near-miss band), and the
  bot now scores 2800–3560 per attempt. But the one trim and the one
  retry rebuild were already spent on level 3, and the stop rule
  forbids further trims — so level 4 is reported as stalled, not
  trimmed. The remaining gap is the row-drop mechanic: in 30 shots up
  to 5 new 10-bubble rows can drop while the board holds > 12 bubbles,
  so the bot must clear ~90 bubbles in 30 shots (~3 pops/shot) and
  ends 9 short. A human chaining combos and drops plausibly clears it,
  but the bot cannot prove it. Coordinator decision needed: another
  small level 4 retune (e.g. 32 shots, or first row-drop later), a
  smarter bot (multi-shot lookahead), or verify 5–20 another way
  (e.g. a debug level-jump). **Levels 5–20 remain UNVERIFIED** —
  progression stops at level 4, so no `09-level13.png` /
  `10-level16.png` / `11-level20.png` exist yet. Do not claim levels
  5–20 are verified.
- **Verified so far (bot autoplay, this build): levels 1, 2, 3 only.**
  Level 1 (clear, 3 rows/3 colours/35 shots), level 2 (pop 15 red,
  5 rows/3 colours/28 shots), level 3 (score 2200, 5 rows/4 colours/
  28 shots). Nothing committed.

## Verification — level 4 retune (32 shots) + U debug unlock + spot-checks (Nov 22, 2026, ~19:33–20:12 PST)
- **Level 4 change** (`main/levels.lua` only): shots **30 → 32**.
  Nothing else changed.
- **Debug unlock — QA aid, not a player feature.** Pressing **U** on the
  title screen unlocks all 20 levels in memory (session-only, never
  persisted). Implementation: `input/game.input_binding` gained a
  `KEY_U` → `debug_unlock` action (required — Defold only delivers
  bound keys, and `game.script` has no input focus; the GUI owns input);
  `main/gui.gui_script` `on_input` forwards it to `game#game` as
  `ui_debug_unlock` only when `self.screen == "title"`;
  `main/game.script` handles `ui_debug_unlock` by setting
  `self.save.unlocked = #levels.LEVELS` in memory and re-showing the
  title. No other game behaviour changed. Note: winning a level after a
  U unlock still persists progress normally via `ui_level_won` — that is
  the ordinary win path, not the debug aid persisting.
- **Rebuild**: bob exit code **0** (19:33); `dist/html5/Bloom Bubbles/`
  rebuilt (8.4 MB, `GD_OPTIONS` `gameId: "PLACEHOLDER"`). Truststore was
  current (`hatch-egress-ca` SHA-256 `3D:6A:96:23:…` matches the live CA
  bundle's last cert — no rebuild needed); extender reverse proxy on
  127.0.0.1:8080 already running. The old `serve-coop.py` on 8901 was
  serving a deleted bundle dir (curl 000) — killed and restarted from
  the fresh bundle dir before verifying (same trap as the previous run).
- **verify.js: 14/14 checks passed**, `verify/results.json`. Level 1 won
  by autoplay (score 1460, board cleared). Note: `verify.js` must be
  given the `verify/redirect.html` file URL — a direct
  `http://127.0.0.1:8901/index.html` navigation is blocked by Chrome's
  local-network-access check.
- **Level progression, run 4** (`verify/verify-levels.js`,
  `verify/run4.log`, `verify/results-levels.json`, 9/11 checks passed —
  the 2 fails are the known COEP-server SDK artifact, `window.gdsdk`
  undefined / no `SDK_READY`, already proven 4/4 true under a plain
  server): level 1 WIN attempt 1 (1400, 9 shots left, board cleared);
  level 2 WIN attempt 1 (1980, 12 shots left); level 3 WIN attempt 1
  (2270 vs 2200 target, 3 shots left); **level 4 LOST all 5 attempts**
  (scores 3270, 3560, 3010, 2850, 3160; final attempt 0 shots,
  **6 bubbles left**). **Highest level reached: 4.** The +2 shots moved
  level 4 from 9 → 6 bubbles left — closer, but still stalled. No
  further trim was made: the stop rule allowed one more rebuild, but a
  trim was not justified without new evidence, and the spot-checks
  below consumed the run's time instead.
- **Spot-checks via U unlock + level select + bot**
  (`verify/spot-check-levels.js`, `verify/run4-spot.log`,
  `verify/results-spot.json`, merged into `verify/results-levels.json`
  under `spotCheck`; up to 3 attempts each, fresh boot per level):
  - **Level 5 WIN attempt 3** (score 1600, 4 shots left, 37 bubbles
    left; pop-20-blue mission — attempts 1–2 lost at 2640 and 1560).
  - **Level 7 LOSE 3×** (2020 / 1360 / 2020, 49 bubbles left; clear,
    7 rows / 5 colours / 24 shots).
  - **Level 10 LOSE 3×** (390, 109 bubbles left; clear, 8 rows /
    6 colours / 22 shots).
  - **Level 13 LOSE 3×** (140, 128 bubbles left; clear, 9 rows /
    6 colours / 22 shots).
  - **Level 16 LOSE 3×** (920, 98 bubbles left; clear, 10 rows /
    6 colours / 21 shots).
  - **Level 20 LOSE 3×** (1070 / 1200 / 230 vs 20,000 target — ~6% —
    133 bubbles left; score, 10 rows / 6 colours / 20 shots).
- **NO trims applied to any spot-checked level**: none is within ~15%
  of its goal (nearest is level 7 at ~45% of bubbles remaining). The
  losing levels are reported as tuning defects, not trimmed.
- **DEFECT — later clear/score levels are a cliff, not a gradient.**
  Bot scores collapse from ~3000 at level 4 to 140–920 at levels 10–16
  and 230–1200 (vs 20,000) at level 20. At 6 colours the board rarely
  offers any 3-match (level 10: 390 points in 22 shots, ≈ 13 pops);
  with a new 10-bubble row every 6 shots the board presents ~110–130
  bubbles against 20–22 shots. Identical scores across retries confirm
  the fixed-seed layouts (`seed = level * 7919 + 13`). Whether a
  skilled human chaining combos could beat them is unproven — the bot
  cannot prove it. Coordinator decision needed: retune the later
  levels (fewer rows / colours, more shots, later first row drop), a
  much stronger bot (multi-shot lookahead), or verify by human play.
  Do not claim levels 6, 8, 9, 11, 12, 14, 15, 17, 18, 19 are verified
  — they were never attempted.
- **Verified so far (bot autoplay, this build): levels 1, 2, 3, 5.**
  Level 4 stalled (6 bubbles left). Levels 7, 10, 13, 16, 20
  spot-checked and LOST (defects above). Levels 6, 8, 9, 11, 12, 14,
  15, 17, 18, 19 never attempted. Rebuilds used: **1 of 2**. Nothing
  committed.

## Verification — level-curve redesign v2.0 + v2.1 iteration (Nov 22, 2026, ~20:13–23:16 PST)

Tuning defect, not a code bug: the original curve (6 colours, 8–10 rows,
20–22 shots, score targets to 20,000) was unwinnable — see the previous
section. All changes below are in `main/levels.lua` ONLY. Levels 1–3
and 5 were bot-verified and were NOT touched. No commits. Rebuilds
used: **2 of 2**.

### Curve v2.0 — before/after (rows / colours / shots / mission)

| Lvl | Before | After (v2.0) |
|-----|--------|--------------|
| 1 | 3r/3c/35 clear | unchanged (verified) |
| 2 | 5r/3c/28 pop 15 red | unchanged (verified) |
| 3 | 5r/4c/28 score 2,200 | unchanged (verified) |
| 4 | 5r/4c/32 clear | 5r/4c/36 clear |
| 5 | 6r/4c/26 pop 20 blue | unchanged (verified) |
| 6 | 6r/5c/26 score 5,000 | 6r/5c/32 score 3,500 |
| 7 | 7r/5c/24 clear | 6r/5c/30 clear |
| 8 | 7r/5c/24 pop 25 green | 7r/5c/28 pop 25 green |
| 9 | 8r/5c/24 score 8,000 | 7r/5c/34 score 5,000 |
| 10 | 8r/6c/22 clear | 6r/5c/30 clear |
| 11 | 9r/6c/22 pop 30 purple | 7r/5c/28 pop 23 purple |
| 12 | 9r/6c/22 score 12,000 | 7r/5c/34 score 6,500 |
| 13 | 9r/6c/22 clear | 7r/5c/32 clear |
| 14 | 9r/6c/21 pop 32 yellow | 7r/5c/28 pop 25 yellow |
| 15 | 10r/6c/21 score 14,000 | 7r/5c/36 score 8,000 |
| 16 | 10r/6c/21 clear | 7r/5c/32 clear |
| 17 | 10r/6c/20 pop 35 pink | 7r/5c/28 pop 25 blue (pink is colour 6, gone with the 5-colour cap) |
| 18 | 10r/6c/20 score 16,000 | 7r/5c/36 score 9,500 |
| 19 | 10r/6c/20 pop 40 red | 7r/5c/28 pop 28 red |
| 20 | 10r/6c/20 score 20,000 | 7r/5c/38 score 11,000 |

Rules applied: colours capped at 5 everywhere; clear missions capped
at 7 rows with 30+ shots; score targets anchored on the verified
economy (level 3: 2,200 at 28 shots, bot ~90–110/shot); pop targets
trimmed in proportion to the row cut. Mission-type rotation and
plain-English texts kept; no level exceeds 11,000.

- **Rebuild 1**: bob exit code **0** (20:17). Truststore current
  (`hatch-egress-ca` SHA-256 `3D:6A:96:23:…` matches the live CA
  bundle's last cert — no rebuild needed). Extender reverse proxy on
  127.0.0.1:8080 and `serve-coop.py` on 8901 were both restarted: the
  old server was serving a deleted bundle dir (curl 000) and the
  proxy had died in a runtime restart. Trap, hit twice this run:
  bob's `bundle` step deletes and recreates
  `dist/html5/Bloom Bubbles/`, so any running `serve-coop.py` whose
  cwd is that dir dies with `FileNotFoundError` on `os.getcwd()` and
  answers every request with an empty reply. Restart the server after
  every rebuild.
- **verify.js on v2.0: 14/14 checks passed**, `verify/results.json`
  (via `verify/redirect.html` file URL; direct localhost navigation
  is still blocked by Chrome's local-network-access check).
- **Progression on v2.0** (`verify/verify-levels.js`,
  `verify/results-levels.json`, 9/11 checks — the 2 fails are the
  known plain-server SDK artifact): level 1 WIN attempt 1 (1300, 16
  shots left); level 2 WIN attempt 1 (2000, 12 left); level 3 WIN
  attempt 1 (2270, 3 left); **level 4 LOST all 5 attempts, best 2
  bubbles left** (scores 3680, 3050, 2220, 2480, 2940). Highest
  level reached: 4.
- **Spot-check pass 1 (v2.0)** via U unlock, up to 3 attempts each
  (`verify/spot-check-levels.js`, `verify/results-spot-v2.0.json`,
  full per-attempt log `/tmp/spot-check-v2.log`, since wiped):
  all 11 changed levels LOST. Best across attempts:
  - L4 clear: 2 bubbles left (progression) / 10 (spot).
  - L6 score: 2,500 / 3,500 = **71%**.
  - L7 clear: **75 bubbles left** (730/87, 730/87, 1,130/75).
  - L9 score: 3,090 / 5,000 = **62%** (1,410, 1,960, 3,090).
  - L10 clear: **29 bubbles left** (2,650/29, 2,650/29, 2,030/44).
  - L12 score: 2,830 / 6,500 = **44%** (2,830, 2,060, 2,180).
  - L13 clear: **31 bubbles left** (4,730/31, 3,560/42, 3,560/42).
  - L15 score: 2,590 / 8,000 = **32%** (2,020, 2,590, 1,730).
  - L16 clear: **64 bubbles left** (1,700/74, 1,700/74, 1,510/64).
  - L18 score: 4,040 / 9,500 = **43%** (4,040, 2,650, 2,790).
  - L20 score: 2,380 / 11,000 = **22%** (2,380, 1,020, 2,380).
- **Root cause, measured.** Scoring is 10 per popped bubble plus
  50 per combo step plus 20 per dropped bubble, so the bot's score
  rate is 55–112 points/shot depending on the board; the v2.0
  targets needed 110–290/shot. Worse for clears: on 5-colour boards
  the bot pops only ~1.4–2.2 bubbles/shot, but break-even is ~2.7
  (1 bubble added per shot + a 10-bubble row every 6 shots while the
  board holds over 12 bubbles), so the board grows instead of
  shrinking — level 7 went 60 → 87 bubbles over 30 shots. Outcomes
  are layout-driven: board layouts are fixed per level
  (`seed = level * 7919 + 13`), attempts on the same layout are often
  near-identical, and the same 5-colour size can be kind (level 10:
  ~3.4 pops/shot) or hopeless (level 7: ~1.5/shot). A skilled human
  chaining combos/drops scores materially more than the bot, so
  70–85% of target is treated as plausibly human-winnable — but only
  bot wins count as verified.

### Curve v2.1 — iteration round (worst offenders only)

- Clears lost a row and gained shots (new layout each, fewer total
  bubbles): L7/L10 5 rows/36 shots, L13/L16 6 rows/36 shots.
  L4 unchanged (2 bubbles left is within ~15%).
- Score targets re-anchored to ~79–81% of the bot's demonstrated
  best per level: L9 5,000 → 3,900; L12 6,500 → 3,600;
  L15 8,000 → 3,300; L18 9,500 → 5,000; L20 11,000 → 3,000.
  L6 kept at 3,500 (71%, inside the human-plausible band).
- **Consequence, flagged:** the score ramp is no longer monotonic
  (3,500 → 3,900 → 3,600 → 3,300 → 5,000 → 3,000), because the
  bot's per-level rate varies by board layout. A steeper,
  monotonic ramp would leave L15/L20 far outside the band again.
  Coordinator call needed on which to prioritise.
- **Rebuild 2**: bob exit code **0** (22:11). Server restarted again
  after the rebuild (same deleted-cwd trap). **verify.js on v2.1:
  14/14 checks passed** (level 1 won by autoplay, score 1,350).
  Progression was not re-run on v2.1: it stops at level 4, which is
  unchanged since v2.0, so the spot-checks below are the re-test.
- **Spot-check pass 2 (v2.1)** (`verify/results-spot.json`, merged
  into `verify/results-levels.json`; pass-1 files preserved as
  `results-spot-v2.0.json` / `results-levels-v2.0.json`): all 9
  adjusted levels LOST again, 3 attempts each. Best across attempts:
  - L7 clear: **48 bubbles left** (1,220/71, 2,940/48, 1,450/50)
    — better than 75, still far outside ~15%.
  - L9 score: 3,090 / 3,900 = **79%** (3,090 in all 3 attempts —
    deterministic ceiling on this layout).
  - L10 clear: **28 bubbles left** (1,200/76, 1,710/49, 2,160/28)
    — no improvement on pass 1's 29; the re-roll did not help.
  - L12 score: 2,870 / 3,600 = **80%** (2,570, 2,830, 2,870).
  - L13 clear: **25 bubbles left** (2,670/27, 3,350/25, 2,450/25)
    — better than 31, still outside ~15%.
  - L15 score: 2,290 / 3,300 = **69%** (1,840, 1,940, 2,290;
    pass-1 best on this layout was 2,590 = 78% — run-to-run
    variance is real).
  - L16 clear: **67 bubbles left** (1,080/79, 1,570/67, 1,550/68)
    — slightly worse than pass 1's 64; the re-roll hurt.
  - L18 score: 3,170 / 5,000 = **63%** (2,710, 3,170, 2,760 —
    the pass-1 4,040 run did not repeat).
  - L20 score: 2,380 / 3,000 = **79%** (2,380, 2,130, 1,860).
- **Run interruptions:** two runtime restarts hit during the v2.1
  spot run (first killed it mid-L20 after ~26 min, second killed the
  re-run at L20 after ~49 min) and wiped `/tmp` logs. The L7–L18
  v2.1 entries were recovered from the live run log polled before
  the restarts; L20 was re-run alone afterwards (3 attempts, above)
  and saved by the script. Values in `results-spot.json` are the
  last-attempt figures the script records, matching its format.
- **Verified so far (bot autoplay, final build): levels 1, 2, 3, 5
  only.** Near-miss / plausibly human-winnable (bot within ~15% on
  clears or 70–85% of score target): L4 (2 bubbles left), L6 (71%),
  L9 (79%), L12 (80%), L15 (69–78%), L20 (79%). Outside the band:
  L7 (48 left), L10 (28 left), L13 (25 left), L16 (67 left),
  L18 (63%). **Never attempted: L8, L11, L14, L17, L19** (pop
  missions — changed in v2.0 but not in the spot-check list, so no
  bot result exists for them). The 5-colour clear missions remain
  the hard problem: even at 5–6 rows the bot's pop rate sits below
  break-even, so further progress needs either 4-colour clears, a
  weaker row-drop rule, or a stronger bot — none of which were in
  scope for this task (2 rebuilds used, stop here).

## KNOWN LIMIT — click-through must be re-tested in a real browser
- Headless Chrome input on this VM needs HELD inputs (~800 ms down-hold)
  because Defold HTML5 input is polled once per engine frame and
  headless SwiftShader runs at a few FPS, so quick clicks fall between
  frames and are never seen. This is a harness artifact, not a game bug
  (same pattern as Pocket Escape; the auto-play bot + held-input verify
  proved the game logic end to end: level 1 won, level 2 started,
  endless scored).
- **Before upload, the parent should click through Play -> level 1 ->
  one manual shot -> pause -> mute toggle in a real browser (or on the
  GD portal preview).** The game code is standard Defold input
  (`acquire_input_focus` + `on_input` + mouse/touch/keyboard binding)
  and there is no evidence of a game-side input defect.
- Input action x/y are in GUI space (origin bottom-left, y up); page
  clicks are top-left origin, y down. A GUI button at (x, y) must be
  clicked at page (x, 1280 - y) — this bit the verify harness, not the
  game.

## Toolchain traps (all hit Nov 22, 2026)
- Vendored extension: bob cannot fetch the gd-defold zip through the
  egress proxy (`Failed to fetch library .../gd-defold/archive/main.zip`).
  Fix: curl the zip, vendor it as `gamedistribution/` +
  `[library] include_dirs = gamedistribution` in `game.project`.
- bob without the `bundle` command writes no bundle: `bob` alone only
  builds. The README command includes `resolve build bundle`.
- Canvas-blankness check via screenshot colour counting, not drawImage:
  `drawImage` returns blank without `preserveDrawingBuffer`. The verify
  script decodes the screenshot PNG and counts distinct colours instead.
- Native-extension engine build goes to build.defold.com via an Apache
  HttpClient with no proxy support; direct TLS is intercepted. Fixed
  with `~/workspace/defold/tools/extender-reverse-proxy.py` (SNI ->
  CONNECT through the egress proxy) + `--build-server
  http://127.0.0.1:8080`. The truststore
  `~/workspace/tools/egress-truststore.jks` must be current (rebuild
  from `/run/hatch/egress-tls/ca-bundle.pem` if the CA rotated).
- Java HTTPS through the egress proxy needs the truststore in
  `JAVA_TOOL_OPTIONS` plus `-Djava.net.preferIPv4Stack=true`.
