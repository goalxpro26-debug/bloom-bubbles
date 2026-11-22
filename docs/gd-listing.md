# Bloom Bubbles — GameDistribution listing copy

Paste-ready for the portal Upload tab. Plain English, no em-dashes.
Character counts verified with Python `len()` (see below).

## Description (367 characters)

Bloom Bubbles is a bright garden bubble shooter. Aim the blossom shooter, match three or more flower bubbles of the same colour, and pop them before they cross the danger line. Play 20 levels with missions and star ratings, or chase a high score in endless mode. Bubbles left hanging fall away, and a new row drops in every few shots. Easy to learn, tricky to master.

## Instructions (420 characters)

Move the mouse or drag your finger to aim the blossom shooter, then click or release to fire a bubble. Match three or more bubbles of the same colour to pop them. Bubbles with nothing above them fall away for bonus points. Clear the mission to win the level and earn up to three stars. A new row drops in every few shots, so keep the bubbles above the red danger line. Arrow keys aim and Space shoots, P pauses the game.

## Facts checked against the game (Nov 22, 2026)

- 20 levels: `main/levels.lua` defines 20 level entries
  (clear / pop-N / score missions), plus an endless mode. Levels 13-20
  were added Nov 22, 2026; the earlier 12-level draft of this doc is
  superseded.
- Stars: 1 to 3 per level, by shots left. Progress and best endless
  score are saved.
- Controls: mouse hover to aim and click to shoot, touch drag to aim
  and release to shoot, arrow keys aim, Space shoots, P pauses.
- Theme: garden, flower-bud bubbles, blossom shooter, red danger line.

## Thumbnails

Source: `verify/01-title.png` (720x1280 title screen, verified good hero
shot: Bloom BUBBLES title, garden scene, PLAY / LEVELS / ENDLESS /
HOW TO PLAY buttons). Portrait source, so landscape sizes use a
top-biased crop to keep the title in frame.

- `dist/gd-upload/thumbnail_512x384.jpg` — 512x384
- `dist/gd-upload/thumbnail_512x512.jpg` — 512x512
- `dist/gd-upload/thumbnail_200x120.jpg` — 200x120

All JPG, quality 90. Regenerate with PIL if the title art changes.
