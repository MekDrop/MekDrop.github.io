export const TileType = {
  WATER: 0,
  GRASS: 1,
  PATH: 2,
  CASTLE_WALL: 3,
  CASTLE_TOWER: 4,
  ENTRY: 5,
};

const MAP_COLS = 28;
const MAP_ROWS = 28;

function rng(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function* cardinalLine(c0, r0, c1, r1) {
  let c = c0, r = r0;
  while (c !== c1 || r !== r1) {
    yield { col: c, row: r };
    const dc = c1 - c, dr = r1 - r;
    if (dc !== 0 && dr !== 0) {
      if (Math.random() < 0.5) c += dc > 0 ? 1 : -1;
      else r += dr > 0 ? 1 : -1;
    } else if (dc !== 0) {
      c += dc > 0 ? 1 : -1;
    } else {
      r += dr > 0 ? 1 : -1;
    }
  }
  yield { col: c, row: r };
}

function* pathIterator(waypoints) {
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i], b = waypoints[i + 1];
    yield* cardinalLine(a.col, a.row, b.col, b.row);
  }
}

function placeCastle(grid, col, row) {
  const layout = [
    [0, 3, 3, 3, 0],
    [3, 3, 4, 3, 3],
    [3, 4, 4, 4, 3],
    [3, 3, 4, 3, 3],
    [0, 3, 3, 3, 0],
  ];
  const half = Math.floor(layout.length / 2);
  for (let dr = 0; dr < layout.length; dr++) {
    for (let dc = 0; dc < layout[dr].length; dc++) {
      const tc = col + dc - half;
      const tr = row + dr - half;
      if (tc >= 0 && tc < MAP_COLS && tr >= 0 && tr < MAP_ROWS && layout[dr][dc] !== 0) {
        grid[tr][tc] = layout[dr][dc];
      }
    }
  }
}

export function generateMap(numPaths) {
  const n = numPaths ?? rng(2, 4);

  const grid = Array.from({ length: MAP_ROWS }, () =>
    new Array(MAP_COLS).fill(TileType.WATER)
  );

  const castleCol = Math.floor(MAP_COLS * 0.76);
  const castleRow = Math.floor(MAP_ROWS * 0.22);
  placeCastle(grid, castleCol, castleRow);

  const allEntries = [
    { col: 0, row: Math.floor(MAP_ROWS * 0.15) },
    { col: 0, row: Math.floor(MAP_ROWS * 0.50) },
    { col: 0, row: Math.floor(MAP_ROWS * 0.78) },
    { col: Math.floor(MAP_COLS * 0.25), row: MAP_ROWS - 1 },
    { col: Math.floor(MAP_COLS * 0.55), row: MAP_ROWS - 1 },
  ];

  const shuffled = [...allEntries].sort(() => Math.random() - 0.5);
  const entries = shuffled.slice(0, n);
  const castleCenter = { col: castleCol, row: castleRow };

  // arrowData: key → [{dc, dr, pathIdx}]
  // Multiple entries per tile when paths share a tile but travel in different directions.
  const arrowData = new Map();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const numWp = rng(2, 4);
    const waypoints = [entry];

    // Safe bounds: waypoints must stay between entry and castle in each dimension
    // so cardinalLine (which is monotone) never overshoots and creates U-turn stubs.
    const scMin = Math.max(1, Math.min(entry.col, castleCol));
    const scMax = Math.min(MAP_COLS - 2, Math.max(entry.col, castleCol));
    const srMin = Math.max(1, Math.min(entry.row, castleRow));
    const srMax = Math.min(MAP_ROWS - 2, Math.max(entry.row, castleRow));

    for (let k = 1; k <= numWp; k++) {
      const t = k / (numWp + 1);
      waypoints.push({
        col: clamp(Math.round(entry.col + (castleCol - entry.col) * t) + rng(-4, 4), scMin, scMax),
        row: clamp(Math.round(entry.row + (castleRow - entry.row) * t) + rng(-4, 4), srMin, srMax),
      });
    }
    waypoints.push(castleCenter);

    // Collect the actual tile sequence AS WE CARVE so random choices are preserved
    const sequence = [];
    for (const pt of pathIterator(waypoints)) {
      sequence.push({ col: pt.col, row: pt.row });
      const cell = grid[pt.row]?.[pt.col];
      if (cell === TileType.WATER) grid[pt.row][pt.col] = TileType.PATH;
    }

    if (grid[entry.row][entry.col] !== TileType.CASTLE_WALL &&
        grid[entry.row][entry.col] !== TileType.CASTLE_TOWER) {
      grid[entry.row][entry.col] = TileType.ENTRY;
    }

    // Derive arrow direction from consecutive tiles in the actual sequence.
    // First occurrence wins — the direction enemies first arrive at a tile.
    for (let j = 0; j < sequence.length - 1; j++) {
      const curr = sequence[j];
      const next = sequence[j + 1];
      const currType = grid[curr.row]?.[curr.col];
      if (currType !== TileType.PATH && currType !== TileType.ENTRY) continue;

      const dc = next.col - curr.col;
      const dr = next.row - curr.row;
      if (dc === 0 && dr === 0) continue; // waypoint tile appears twice — skip the duplicate
      const key = `${curr.col},${curr.row}`;

      if (!arrowData.has(key)) arrowData.set(key, []);
      const list = arrowData.get(key);
      // One entry per path per tile; first occurrence of tile in this path sets direction
      if (!list.some(e => e.pathIdx === i)) {
        list.push({ dc, dr, pathIdx: i });
      }
    }
  }

  // Grass border around non-water tiles
  const toGrass = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (grid[r][c] !== TileType.WATER) {
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS &&
                grid[nr][nc] === TileType.WATER) {
              toGrass.push([nr, nc]);
            }
          }
        }
      }
    }
  }
  for (const [r, c] of toGrass) grid[r][c] = TileType.GRASS;

  return { grid, cols: MAP_COLS, rows: MAP_ROWS, entries, castlePos: castleCenter, numPaths: n, arrowData };
}
