-- Bloom Bubbles: level definitions + mission text.
-- Mission types: "clear" (pop every bubble), "pop" (pop N of one colour),
-- "score" (reach a score). Every level also has a shots limit and gains a
-- new row every ROW_EVERY shots while the board is still big.
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
    mission = { type = "score", target = 3000, text = "Score 3,000 points" } },
  { rows = 6, colors = 4, shots = 26,
    mission = { type = "clear", text = "Clear all the bubbles!" } },
  { rows = 6, colors = 4, shots = 26,
    mission = { type = "pop", color = 4, target = 20,
                text = "Pop 20 blue bubbles" } },
  { rows = 6, colors = 5, shots = 26,
    mission = { type = "score", target = 5000, text = "Score 5,000 points" } },
  { rows = 7, colors = 5, shots = 24,
    mission = { type = "clear", text = "Clear all the bubbles!" } },
  { rows = 7, colors = 5, shots = 24,
    mission = { type = "pop", color = 3, target = 25,
                text = "Pop 25 green bubbles" } },
  { rows = 8, colors = 5, shots = 24,
    mission = { type = "score", target = 8000, text = "Score 8,000 points" } },
  { rows = 8, colors = 6, shots = 22,
    mission = { type = "clear", text = "Clear all the bubbles!" } },
  { rows = 9, colors = 6, shots = 22,
    mission = { type = "pop", color = 5, target = 30,
                text = "Pop 30 purple bubbles" } },
  { rows = 9, colors = 6, shots = 22,
    mission = { type = "score", target = 12000, text = "Score 12,000 points" } },
}

M.ENDLESS = { rows = 5, colors = 5, shots = 0, -- 0 = unlimited
  mission = { type = "endless", text = "Pop as many as you can!" } }

function M.get(n)
  return M.LEVELS[math.max(1, math.min(#M.LEVELS, n))]
end

return M
