-- Bloom Bubbles: level definitions + mission text.
-- Mission types: "clear" (pop every bubble), "pop" (pop N of one colour),
-- "score" (reach a score). Every level also has a shots limit and gains a
-- new row every ROW_EVERY shots while the board is still big.
--
-- Curve v2 (Nov 22, 2026): max 5 colours everywhere (6-colour boards
-- starved for matches), clear missions capped at 7 rows with 30+ shots,
-- score targets anchored on the verified economy (level 3: 2,200 at
-- 28 shots; bot scores ~90-110 per shot). Levels 1-3 and 5 are
-- bot-verified and were NOT touched.
-- Curve v2.1 (same day, iteration round): pass-1 spot-check showed the
-- bot reaches only 22-71% of the v2 score targets and leaves 29-75
-- bubbles on the 5-colour clears, so clears lost a row and gained
-- shots (L7/L10 5 rows/36, L13/L16 6 rows/36) and score targets were
-- re-anchored to ~79-81% of the bot's demonstrated best per level
-- (L9 3,900, L12 3,600, L15 3,300, L18 5,000, L20 3,000; L6 kept
-- 3,500 at 71%, inside the human-plausible band). Consequence: the
-- score ramp is no longer monotonic, because the bot's per-level
-- rate varies by board layout.
local M = {}

M.COLOR_NAMES = { "red", "yellow", "green", "blue", "purple", "pink" }
M.ROW_EVERY_LEVEL = 6
M.ROW_EVERY_ENDLESS = 5

M.LEVELS = {
  { rows = 3, colors = 3, shots = 35,
    mission = { type = "clear", text = "Clear all the bubbles!" } },
  { rows = 5, colors = 3, shots = 28,
    mission = { type = "pop", color = 1, target = 15,
                text = "Pop 15 red bubbles" } },
  { rows = 5, colors = 4, shots = 28,
    mission = { type = "score", target = 2200, text = "Score 2,200 points" } },
  { rows = 5, colors = 4, shots = 36,
    mission = { type = "clear", text = "Clear all the bubbles!" } },
  { rows = 6, colors = 4, shots = 26,
    mission = { type = "pop", color = 4, target = 20,
                text = "Pop 20 blue bubbles" } },
  { rows = 6, colors = 5, shots = 32,
    mission = { type = "score", target = 3500, text = "Score 3,500 points" } },
  { rows = 5, colors = 5, shots = 36,
    mission = { type = "clear", text = "Clear all the bubbles!" } },
  { rows = 7, colors = 5, shots = 28,
    mission = { type = "pop", color = 3, target = 25,
                text = "Pop 25 green bubbles" } },
  { rows = 7, colors = 5, shots = 34,
    mission = { type = "score", target = 3900, text = "Score 3,900 points" } },
  { rows = 5, colors = 5, shots = 36,
    mission = { type = "clear", text = "Clear all the bubbles!" } },
  { rows = 7, colors = 5, shots = 28,
    mission = { type = "pop", color = 5, target = 23,
                text = "Pop 23 purple bubbles" } },
  { rows = 7, colors = 5, shots = 34,
    mission = { type = "score", target = 3600, text = "Score 3,600 points" } },
  { rows = 6, colors = 5, shots = 36,
    mission = { type = "clear", text = "Clear all the bubbles!" } },
  { rows = 7, colors = 5, shots = 28,
    mission = { type = "pop", color = 2, target = 25,
                text = "Pop 25 yellow bubbles" } },
  { rows = 7, colors = 5, shots = 36,
    mission = { type = "score", target = 3300, text = "Score 3,300 points" } },
  { rows = 6, colors = 5, shots = 36,
    mission = { type = "clear", text = "Clear all the bubbles!" } },
  { rows = 7, colors = 5, shots = 28,
    mission = { type = "pop", color = 4, target = 25,
                text = "Pop 25 blue bubbles" } },
  { rows = 7, colors = 5, shots = 36,
    mission = { type = "score", target = 5000, text = "Score 5,000 points" } },
  { rows = 7, colors = 5, shots = 28,
    mission = { type = "pop", color = 1, target = 28,
                text = "Pop 28 red bubbles" } },
  { rows = 7, colors = 5, shots = 38,
    mission = { type = "score", target = 3000, text = "Score 3,000 points" } },
}

M.ENDLESS = { rows = 5, colors = 5, shots = 0, -- 0 = unlimited
  mission = { type = "endless", text = "Pop as many as you can!" } }

function M.get(n)
  return M.LEVELS[math.max(1, math.min(#M.LEVELS, n))]
end

return M
