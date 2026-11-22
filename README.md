# Bloom Bubbles

An original garden bubble shooter for GameDistribution (HTML5), built with
Defold 1.14.0. Game 2 of the GD factory queue.

## The game

Aim the blossom shooter, match 3+ flower-bud bubbles of the same colour to
pop them. Bubbles left hanging with nothing above them fall away. A new row
drops in every few shots — don't let any bubble cross the red danger line.

- **12 levels** with missions: clear the board, pop N of one colour, or
  reach a score target. Stars (1–3) by shots left; progress saved.
- **Endless mode**: score attack, rows keep coming, best score saved.
- **Missions UI**: mission text + live progress on the HUD, mission-complete
  banner, confetti + jingle on win.
- **Controls**: mouse (hover to aim, click to shoot), touch (drag to aim,
  release to shoot), keyboard (arrows aim, Space shoots, P pauses).
  Hidden verification aid: press **A** to toggle an auto-play bot.
- **Audio**: 9 synthesized SFX + 2 music loops, all generated locally by
  `tools/synth_audio.py` (numpy, no AI audio, no downloads).
- **Art**: all sprites drawn in code by `tools/make_art.py` (PIL, no AI
  images, no copied assets). Bright 2D cartoon garden theme.
- **Animations**: pop bursts, falling clusters, combo popups, shooter
  recoil, aim guide dots, tweened panels (gui.animate), win confetti.

## GameDistribution SDK

- Extension vendored locally under `gamedistribution/` (see below).
- `game.project` has `[gamedistribution] game_id = PLACEHOLDER` — the parent
  fills the real HEX Game ID from the portal Upload tab before upload.
- Ads only on user input: pre-roll interstitial on the first Play tap,
  interstitial when the player taps Next on a level-complete screen.
- `SDK_GAME_PAUSE` pauses the game + mutes audio; `SDK_GAME_START` resumes
  + unmutes. All `gdsdk` calls are guarded (`if gdsdk then`) so the game
  runs fine with no SDK / no network.

## Building (this VM)

bob's Java HTTPS cannot reach the internet through the egress proxy, so two
workarounds are baked in (both live in `~/workspace/tools/`):

1. **GD extension**: bob cannot fetch the dependency URL
   (`Failed to fetch library .../gd-defold/archive/main.zip`). The zip was
   downloaded with `curl` and vendored as a local library:
   `gamedistribution/` (the upstream `gamedistribution/` folder, verbatim)
   + `[library] include_dirs = gamedistribution` in `game.project`.
   The URL dependency line was removed. Keep `game_id = PLACEHOLDER`.
2. **Native-extension engine build**: any native extension forces bob to
   build the engine on the remote extender (`build.defold.com`), but
   bob's Apache HttpClient ignores JVM proxy settings. A local reverse
   proxy forwards bob to the extender through the egress proxy:
   `extender-reverse-proxy.py` on 127.0.0.1:8080 (start it first), then
   pass `--build-server http://127.0.0.1:8080` to bob. The truststore
   `egress-truststore.jks` must be current (rebuild from
   `/run/hatch/egress-tls/ca-bundle.pem` if the CA rotated).

Build:

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

## Verifying

```bash
cd dist/html5/"Bloom Bubbles"
python3 -m http.server 8901 &
node ~/workspace/defold/projects/bloom-bubbles/verify/verify.js \
  http://127.0.0.1:8901/index.html
```

The game reports live state in `document.title`
(`BLOOM|screen=...|score=...|bubbles=...|shots=...|...`) which the
verify script polls. Screenshots land in `verify/`.

**Verification record (Nov 22, 2026):** `verify/verify.js` against the GD
bundle (`dist/html5/Bloom Bubbles/`, served on localhost:8901) — **14/14
checks passed**, `verify/results.json`. Title loads, canvas non-blank,
PLAY starts level 1 (30 bubbles, 35 shots), manual shot fires
(35 -> 34), pause/resume, autoplay wins level 1 (score 1250, board
cleared, 21 shots left), NEXT LEVEL starts level 2 (50 bubbles),
endless mode scores (0 -> 40), pause in endless, mute toggle, no
page/console errors (excluding GD SDK ad-network noise).

**Headless-verification gotchas (all found Nov 22, do not re-diagnose):**
1. Defold HTML5 input is **polled once per engine frame**; headless
   SwiftShader runs at a few FPS, so quick Playwright clicks/presses
   fall between frames and are never seen. Use **held inputs**
   (down, hold ~800 ms, up). This is a harness artifact, not a game bug.
2. Input action x/y are in **GUI space (origin bottom-left, y up)**,
   but Playwright clicks in **page space (origin top-left, y down)**.
   A GUI button at (x, y) must be clicked at page (x, 1280 - y).
3. `verify.js` used to check canvas blankness with `drawImage` — that
   returns blank without `preserveDrawingBuffer`. It now decodes the
   screenshot PNG and counts distinct colors instead.
4. `bob` without a command only **builds**; the bundle is written only
   when the `bundle` command is passed (README command above includes it).
5. The auto-play bot simulates candidate aim angles (flight + wall
   bounce via `board.would_stick`/`snap_cell`), scores each landing by
   match size + dropped clusters, and fires the best. The first naive
   bot (aim at lowest same-colour bubble) lost level 1; the simulation
   bot clears it with 21 shots to spare.

## Files

- `main/` — `game.script` (controller/save/GD/music), `gui.gui_script`
  (all screens, board rendering, input, animations), `board.lua` (pure
  board logic), `levels.lua` (12 levels + endless), `audio.lua`
- `art/` — PIL-drawn PNGs + `atlas.atlas`
- `audio/` — synthesized WAVs + `.sound` files + `audio.go`
- `tools/` — `make_art.py`, `synth_audio.py`
- `input/game.input_binding` — mouse + touch + keyboard
- `verify/` — Playwright verification script + screenshots
