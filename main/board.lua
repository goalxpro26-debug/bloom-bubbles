-- Bloom Bubbles: pure board logic (no Defold API). Hex-offset grid, 10 cols.
-- Row 1 is the top row. Odd rows are shifted right by one radius.
local M = {}

M.COLS = 10
M.R = 30            -- bubble radius
M.DX = 60           -- column spacing
M.DY = 52           -- row spacing (hex packing)
M.X0 = 60           -- centre x of column 1 on odd rows
M.TOP_Y = 1150      -- centre y of row 1
M.W = 720
M.DANGER_Y = 360    -- a bubble centre below this line loses the game
M.SHOOT_X = 360
M.SHOOT_Y = 150

function M.cell_pos(row, col)
  local x = M.X0 + (col - 1) * M.DX + (row % 2 == 0 and M.R or 0)
  local y = M.TOP_Y - (row - 1) * M.DY
  return x, y
end

function M.new(rows, ncolors, seed)
  math.randomseed(seed)
  local grid = {}
  for r = 1, rows do
    grid[r] = {}
    for c = 1, M.COLS do
      local col
      repeat
        col = math.random(ncolors)
      until not (c >= 3 and grid[r][c - 1] == col and grid[r][c - 2] == col)
      grid[r][c] = col
    end
  end
  return { grid = grid, rows = rows }
end

function M.get(b, row, col)
  if row < 1 or row > b.rows or col < 1 or col > M.COLS then return nil end
  return b.grid[row][col]
end

function M.count(b)
  local n = 0
  for r = 1, b.rows do
    for c = 1, M.COLS do
      if b.grid[r][c] then n = n + 1 end
    end
  end
  return n
end

function M.colors_present(b)
  local seen = {}
  for r = 1, b.rows do
    for c = 1, M.COLS do
      local v = b.grid[r][c]
      if v then seen[v] = true end
    end
  end
  return seen
end

local function neighbors(row, col)
  if row % 2 == 1 then
    return { { -1, -1 }, { -1, 0 }, { 0, -1 }, { 0, 1 }, { 1, -1 }, { 1, 0 } }
  else
    return { { -1, 0 }, { -1, 1 }, { 0, -1 }, { 0, 1 }, { 1, 0 }, { 1, 1 } }
  end
end

-- Flood fill: all connected cells of the same colour as (row, col).
function M.cluster(b, row, col)
  local color = M.get(b, row, col)
  if not color then return {} end
  local out = {}
  local seen = {}
  local stack = { { row, col } }
  seen[row .. "," .. col] = true
  while #stack > 0 do
    local cell = table.remove(stack)
    local r, c = cell[1], cell[2]
    out[#out + 1] = { r, c }
    for _, off in ipairs(neighbors(r, c)) do
      local nr, nc = r + off[1], c + off[2]
      local key = nr .. "," .. nc
      if not seen[key] and M.get(b, nr, nc) == color then
        seen[key] = true
        stack[#stack + 1] = { nr, nc }
      end
    end
  end
  return out
end

-- Cells connected to the ceiling (row 1). Everything else floats.
function M.attached(b)
  local seen = {}
  local stack = {}
  for c = 1, M.COLS do
    if b.grid[1] and b.grid[1][c] then
      seen["1," .. c] = true
      stack[#stack + 1] = { 1, c }
    end
  end
  while #stack > 0 do
    local cell = table.remove(stack)
    local r, c = cell[1], cell[2]
    for _, off in ipairs(neighbors(r, c)) do
      local nr, nc = r + off[1], c + off[2]
      local key = nr .. "," .. nc
      if not seen[key] and M.get(b, nr, nc) then
        seen[key] = true
        stack[#stack + 1] = { nr, nc }
      end
    end
  end
  return seen
end

function M.floating(b)
  local att = M.attached(b)
  local out = {}
  for r = 1, b.rows do
    for c = 1, M.COLS do
      if b.grid[r][c] and not att[r .. "," .. c] then
        out[#out + 1] = { r, c }
      end
    end
  end
  return out
end

-- Nearest free cell to a point (searches a small neighbourhood first,
-- then the whole board). Returns row, col or nil.
function M.snap_cell(b, x, y)
  local approx_row = math.floor((M.TOP_Y - y) / M.DY + 0.5) + 1
  local best, best_d
  for dr = -2, 2 do
    for dc = -2, 2 do
      local r = approx_row + dr
      local c = math.floor((x - M.X0) / M.DX + 0.5) + 1 + dc
      if r >= 1 and r <= b.rows + 1 and c >= 1 and c <= M.COLS then
        if not M.get(b, r, c) then
          local cx, cy = M.cell_pos(r, c)
          local d = (cx - x) * (cx - x) + (cy - y) * (cy - y)
          if not best_d or d < best_d then
            best, best_d = { r, c }, d
          end
        end
      end
    end
  end
  if best then return best[1], best[2] end
  -- Fallback: any free cell in the top rows.
  for r = 1, b.rows + 1 do
    for c = 1, M.COLS do
      if not M.get(b, r, c) then return r, c end
    end
  end
  return nil
end

-- Collision test for a flying bubble centre: true when it touches the
-- ceiling or any settled bubble.
function M.would_stick(b, x, y)
  if y >= M.TOP_Y then return true end
  local rr = 2 * M.R - 3
  for r = 1, b.rows do
    for c = 1, M.COLS do
      if b.grid[r][c] then
        local cx, cy = M.cell_pos(r, c)
        local dx, dy = cx - x, cy - y
        if dx * dx + dy * dy < rr * rr then return true end
      end
    end
  end
  return false
end

-- Insert a new random row at the top, pushing everything down.
-- Returns the new row's cells as {row=1, col, color} (row is always 1).
function M.add_row(b, ncolors)
  local row = {}
  for c = 1, M.COLS do
    row[c] = math.random(ncolors)
  end
  table.insert(b.grid, 1, row)
  b.rows = b.rows + 1
  local cells = {}
  for c = 1, M.COLS do cells[#cells + 1] = { 1, c, row[c] } end
  return cells
end

-- Lowest bubble centre on the board (nil when empty).
function M.lowest_y(b)
  local low = nil
  for r = 1, b.rows do
    for c = 1, M.COLS do
      if b.grid[r][c] then
        local _, y = M.cell_pos(r, c)
        if not low or y < low then low = y end
      end
    end
  end
  return low
end

return M
