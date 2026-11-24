# Bloom Bubbles — GamePix conversion notes

GamePix build: `dist/html5/Bloom Bubbles/` (7.9 MB) + upload pack
`dist/gpx-upload/` (zip 4,179,996 bytes, cover 1360x850, icon 256x256,
description/instructions/tags). GamePix SDK v3, manual lifecycle.
The GameDistribution build is untouched in `dist/gd-upload/` and the GD
portal entry (81497) stays In Review — the two lanes are separate.

## What the conversion changed (GamePix SDK v3, no native extension)

- New `main/gpx.lua`: pure-Lua bridge over `html5.run` (`pcall(require,
  "html5")`, so the game runs fully without the SDK). `loaded()` (once:
  `lifecycle.loading(100)` + `loaded()`, sets
  `window.__gpx_loaded_called=1`), `game_start()` (once, sets
  `window.__gpx_started=1`), `show_interstitial()` (fire-and-forget
  `GamePix.ads.interstitial()`), `happy_moment(kind)` / `sad_moment(kind)`,
  `poll_paused()` (true when `__gpx_paused` or `__gpx_hidden` is 1),
  `sdk_present()`. All calls guarded.
- `main/game.script`: GD listener block removed; `update()` polls
  `gpx.poll_paused()` once per frame and applies ad-pause transitions
  (mute + `ad_pause` / `ad_resume` GUI messages); `show_ad` calls
  `gpx.show_interstitial()`; `gpx.loaded()` in `show_title` (once-only
  guard inside); `gpx.game_start()` in `start_level`;
  `happy_moment("level_complete")` on `ui_level_won`;
  `sad_moment("game_over")` (endless) / `"level_failed"` (normal) on
  `ui_level_lost`.
- `main/gui.gui_script`: `gd_pause` / `gd_resume` messages renamed to
  `ad_pause` / `ad_resume` (incl. the stale-pause comment).
- `game.project`: `[library] include_dirs = gamedistribution` and
  `[gamedistribution] game_id = 07955f...` removed.
- `gamedistribution/` folder moved OUT of the project to sibling backup
  `~/workspace/defold/projects/bloom-bubbles-gd-extension/` (Defold
  discovers extensions by scanning for `ext.manifest`; removing the
  game.project lines alone did NOT stop bob from using it — first
  rebuild failed with `MustacheException: ... requires
  'gamedistribution.game_id'`). The folder is tracked in git, so
  history preserves it too.
- `tools/inject_gamepix.py`: post-processes the built `index.html` —
  inserts `window.GamePixConfig = { lifecycle: 'manual' }` + the SDK
  script (`https://integration.gamepix.com/sdk/v3/gamepix.sdk.js`) +
  glue JS as the first scripts in `<head>`; glue registers
  pause/resume handlers setting `window.__gpx_paused`, tracks
  visibility in `window.__gpx_hidden`, calls `lifecycle.loading(0)`;
  adds `body{touch-action:none}`; verifies SDK present and NO
  GameDistribution residue; idempotent. Run after every rebuild.
- Ads: pre-roll interstitial on first Play tap, interstitial on
  Next Level (level complete). Pause during ads is automatic (SDK calls
  our pause handler before the ad, resume after); the game also mutes
  audio while paused. No rewarded ads (no reward flow in the game).

## Build (canonical, proven Nov 24, 2026)

From the project dir, with the egress truststore in JAVA_TOOL_OPTIONS:

```
export JAVA_TOOL_OPTIONS="-Djava.net.preferIPv4Stack=true -Djavax.net.ssl.trustStore=$HOME/workspace/tools/egress-truststore.jks -Djavax.net.ssl.trustStorePassword=changeit"
~/workspace/defold/run-bob.sh --platform wasm-web --variant release --archive --bundle-output dist/html5 resolve build bundle
python3 tools/inject_gamepix.py "dist/html5/Bloom Bubbles"
```

No `--build-server` needed (no native extensions in the GamePix build).
The `resolve build bundle` verbs are REQUIRED (without them bob exits 0
and writes no bundle). After any extension/template change, clean
`build/` and the bundle dir first — bob's incremental build reuses the
cached GD template otherwise. Always confirm the bundle timestamp
before injecting (the first injector run "verified" against the stale
Nov 23 GD bundle).

## Verify — Chrome 157 LNA lesson (Nov 24, 2026)

Headless Chrome 157 (Muse Browser 157.0.8103.81) blocks navigation to
ANY loopback http origin with `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`,
and `--disable-features=LocalNetworkAccessChecks` no longer disables it
(tested: proxy / no-proxy / localhost / 127.0.0.1 all fail;
`grantPermissions('local-network-access')` does not cover
CDP-initiated navigations; the VM's LAN IP 198.19.0.2 is intercepted by
the sandbox gateway). The working route is **file://**: serve nothing,
load `file:///.../dist/html5/Bloom Bubbles/index.html` directly. The
Defold template does NOT auto-boot from file:// (it only shows a
"running from file" warning), so the harness calls
`EngineLoader.load("canvas", "BloomBubbles")` manually after load.
The GamePix SDK script loads fine from file:// (https CDN via the 3129
forwarding proxy — start `~/workspace/tools/egress-proxy-forward.py`
first) and localStorage works there, so the SDK checks still run for
real. Harness: `verify/verify_gpx.js` (copy of the GD `verify.js`, OUT
`verify/gpx/`), with GamePix checks added: SDK object +
lifecycle/ads/events API, `__gpx_loaded_called`, `__gpx_started`,
pre-roll + level-complete interstitial pause/resume observation, no GD
residue, plus the full gameplay battery (PLAY, manual shot,
pause/resume, autoplay win L1, NEXT LEVEL to L2, quit to title,
ENDLESS scores, mute toggle, no errors).

## Assets (all from real GamePix-build gameplay, verify/gpx/)

- Cover 1360x850 (`dist/gpx-upload/cover_1360x850.jpg`, 195,711 bytes):
  gameplay shot 03, crop below the "Left: N bubbles" HUD text and above
  the mission banner, bold BLOOM BUBBLES title over clean sky.
- Icon 256x256 (`dist/gpx-upload/icon_256x256.jpg`, 26,085 bytes):
  middle bubble columns from shot 03 (banner excluded), bold title.
- Built with `~/workspace/defold/projects/tools/make_gpx_assets.py`
  (mirrors the GD thumbnail script; same crop/title helpers).

## Listing (GamePix dashboard)

- Description: `dist/gpx-upload/description.txt` (368 chars, fits the
  100-500 char field, no em-dashes). Instructions:
  `dist/gpx-upload/instructions.txt` (421 chars, fits the ≤500 char
  How to Play field). Tags: `dist/gpx-upload/tags.txt` — bubble,
  arcade, matching, logic, relaxing (GD-verified; re-check against
  GamePix's own picker at listing time, drop anything it doesn't
  offer, never invent replacements).
- Category: Puzzle. Main tag: puzzle (check the picker). Orientation:
  Portrait (game is 720x1280 portrait). Engine: HTML5-JS. SDK
  integration: checked. Desktop + Mobile friendly: both checked.
- "Allow Distribution": ON (owner maximises distribution; non-exclusive).
- REVIEW LOCK: once submitted for review the build is LOCKED (no
  withdraw/cancel; Build tab hides Browse). Submit only the verified
  final build. If QA requests changes, the game returns to EDIT and
  builds unlock.

## Re-enable GameDistribution (GD lane, do NOT do this for GamePix)

1. Copy `~/workspace/defold/projects/bloom-bubbles-gd-extension/gamedistribution/`
   back into the project as `gamedistribution/`.
2. Restore `game.project` from git: `[library] include_dirs =
   gamedistribution` + `[gamedistribution] game_id =
   07955f6876a044aba4887d68e84123ca`.
3. Rebuild with the extender reverse proxy + `--build-server
   http://127.0.0.1:8080` (GD extension needs the extender), verbs
   `resolve build bundle`, then re-zip into `dist/gd-upload/`.
4. The GamePix files (`main/gpx.lua`, injector, verify_gpx.js) stay in
   the repo unused by the GD build; `main/game.script` would need its
   GD listener restored from git (the GamePix edit replaced it).
