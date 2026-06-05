export const TileType = {
  WATER: 0,
  GRASS: 1,
  PATH: 2,
  CASTLE_WALL: 3,
  CASTLE_TOWER: 4,
  ENTRY: 5,
};

const TILE_SCALE = 2;
const COARSE_COLS = 21;
const COARSE_ROWS = 21;
const MAP_COLS = COARSE_COLS * TILE_SCALE;
const MAP_ROWS = COARSE_ROWS * TILE_SCALE;
const DEFAULT_MIN_PATHS = 2;
const DEFAULT_MAX_PATHS = 4;
const MIN_WAYPOINTS = 1;
const MAX_WAYPOINTS = 3;
const WAYPOINT_OFFSET = 8;
const MAX_ROUTE_ATTEMPTS = 600;
const ALLOWED_MERGE_TAIL_TILES = 4;
const MIN_GRASS_GAP_BETWEEN_PATHS = 4;

function rng(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function* cardinalLine(c0, r0, c1, r1) {
  let c = c0, r = r0;
  // Strict L-shape: go entirely in one axis, then the other for clean 90-degree turns.
  if (Math.random() < 0.5) {
    while (c !== c1) { yield { col: c, row: r }; c += c < c1 ? 1 : -1; }
    while (r !== r1) { yield { col: c, row: r }; r += r < r1 ? 1 : -1; }
  } else {
    while (r !== r1) { yield { col: c, row: r }; r += r < r1 ? 1 : -1; }
    while (c !== c1) { yield { col: c, row: r }; c += c < c1 ? 1 : -1; }
  }
  yield { col: c1, row: r1 };
}

function* pathIterator(waypoints) {
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i], b = waypoints[i + 1];
    yield* cardinalLine(a.col, a.row, b.col, b.row);
  }
}

function manhattan(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function routeLength(sequence) {
  let length = 0;
  for (let i = 0; i < sequence.length - 1; i++) {
    length += manhattan(sequence[i], sequence[i + 1]);
  }
  return length;
}

function tileKey(tile) {
  return `${tile.col},${tile.row}`;
}

function protectedSequence(sequence) {
  return sequence.slice(0, Math.max(0, sequence.length - ALLOWED_MERGE_TAIL_TILES));
}

function hasNearbyFootprint(cell, blockedFootprints, { includeSelf = true } = {}) {
  if (!blockedFootprints) return false;

  for (let dr = -MIN_GRASS_GAP_BETWEEN_PATHS; dr <= MIN_GRASS_GAP_BETWEEN_PATHS; dr++) {
    for (let dc = -MIN_GRASS_GAP_BETWEEN_PATHS; dc <= MIN_GRASS_GAP_BETWEEN_PATHS; dc++) {
      if (Math.abs(dr) + Math.abs(dc) > MIN_GRASS_GAP_BETWEEN_PATHS) continue;
      if (!includeSelf && dr === 0 && dc === 0) continue;
      if (blockedFootprints.has(footprintKey(cell.row + dr, cell.col + dc))) return true;
    }
  }

  return false;
}

function routeConflictCount(
  sequence,
  blockedCenterlines,
  blockedFootprints,
  reservedEntryFootprints,
  ownEntryFootprint
) {
  if (!blockedCenterlines && !blockedFootprints && !reservedEntryFootprints) return 0;

  let conflicts = 0;
  const safeSequence = protectedSequence(sequence);
  const safeFootprints = buildTwoTileFootprint(safeSequence);
  for (let i = 0; i < safeSequence.length; i++) {
    if (blockedCenterlines?.has(tileKey(safeSequence[i]))) conflicts++;
  }

  for (const cell of buildTwoTileFootprint(sequence).values()) {
    const key = footprintKey(cell.row, cell.col);
    const isMergeTailCell = !safeFootprints.has(key);
    const exactOverlap = blockedFootprints?.has(key) ?? false;
    const hasNearbyParallelFootprint = hasNearbyFootprint(cell, blockedFootprints, { includeSelf: false });

    if (hasNearbyParallelFootprint) conflicts++;
    if (exactOverlap && !isMergeTailCell) conflicts++;

    if (reservedEntryFootprints?.has(key) && !ownEntryFootprint?.has(key)) conflicts += 100;
  }

  return conflicts;
}

function sequenceFromWaypoints(waypoints) {
  const sequence = [];
  for (const pt of pathIterator(waypoints)) {
    const last = sequence[sequence.length - 1];
    if (!last || last.col !== pt.col || last.row !== pt.row) {
      sequence.push({ col: pt.col, row: pt.row });
    }
  }
  return sequence;
}

function dedupeSequence(sequence) {
  const deduped = [];
  for (const tile of sequence) {
    const last = deduped[deduped.length - 1];
    if (!last || last.col !== tile.col || last.row !== tile.row) {
      deduped.push(tile);
    }
  }
  return deduped;
}

function createWaypoints(entry, castle) {
  const numWp = rng(MIN_WAYPOINTS, MAX_WAYPOINTS);
  const waypoints = [entry];

  const clampProgress = (value, previous, target) => {
    if (target === previous) return target;
    return target > previous
      ? clamp(value, previous, target)
      : clamp(value, target, previous);
  };

  for (let k = 1; k <= numWp; k++) {
    const t = k / (numWp + 1);
    const previous = waypoints[waypoints.length - 1];
    const rawCol = Math.round(entry.col + (castle.col - entry.col) * t) + rng(-WAYPOINT_OFFSET, WAYPOINT_OFFSET);
    const rawRow = Math.round(entry.row + (castle.row - entry.row) * t) + rng(-WAYPOINT_OFFSET, WAYPOINT_OFFSET);
    const wpCol = clampProgress(rawCol, previous.col, castle.col);
    const wpRow = clampProgress(rawRow, previous.row, castle.row);
    waypoints.push({ col: wpCol, row: wpRow });
  }

  waypoints.push(castle);
  return waypoints;
}

function normalizeOptions(options) {
  if (typeof options === 'number') return { numPaths: options };
  return options ?? {};
}

function normalizeLengthRules({ minPathLength, maxPathLength }) {
  const hasMin = Number.isFinite(minPathLength);
  const hasMax = Number.isFinite(maxPathLength);

  if (!hasMin && !hasMax) return null;

  return {
    min: hasMin ? Math.max(0, Math.round(minPathLength)) : 0,
    max: hasMax ? Math.max(0, Math.round(maxPathLength)) : Infinity,
  };
}

function createRoute(
  entry,
  castle,
  lengthRules,
  blockedCenterlines,
  blockedFootprints,
  reservedEntryFootprints,
  ownEntryFootprint
) {
  let best = null;
  const shouldRetry = lengthRules !== null;

  for (let attempt = 0; attempt < MAX_ROUTE_ATTEMPTS; attempt++) {
    const waypoints = createWaypoints(entry, castle);
    const sequence = sequenceFromWaypoints(waypoints);
    const length = routeLength(sequence);
    const conflicts = routeConflictCount(
      sequence,
      blockedCenterlines,
      blockedFootprints,
      reservedEntryFootprints,
      ownEntryFootprint
    );
    const min = lengthRules?.min ?? 0;
    const max = lengthRules?.max ?? Infinity;
    const midpoint = Number.isFinite(max) ? (min + max) / 2 : min;
    const score = conflicts * 1000 + Math.abs(length - midpoint);
    const route = { waypoints, sequence, length, conflicts };

    if (conflicts === 0 && (!shouldRetry || (length >= min && length <= max))) return route;
    if (!best || score < best.score) best = { ...route, score };
  }

  return best;
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

function spawnPlatform(grid, col, row, w, h) {
  const hw = Math.floor(w / 2);
  const hh = Math.floor(h / 2);
  for (let dr = -hh; dr <= hh; dr++) {
    for (let dc = -hw; dc <= hw; dc++) {
      if (Math.abs(dr) === hh && Math.abs(dc) === hw) continue; // clip corners
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS && grid[nr][nc] === TileType.WATER) {
        grid[nr][nc] = TileType.GRASS;
      }
    }
  }
}

function setGrass(grid, row, col) {
  if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS && grid[row][col] === TileType.WATER) {
    grid[row][col] = TileType.GRASS;
  }
}

function setPath(grid, row, col) {
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return;
  const tile = grid[row][col];
  if (tile === TileType.CASTLE_WALL || tile === TileType.CASTLE_TOWER) return;
  if (tile === TileType.WATER || tile === TileType.GRASS) {
    grid[row][col] = TileType.PATH;
  }
}

function isRouteTile(tile) {
  return tile === TileType.PATH || tile === TileType.ENTRY;
}

function setEntry(grid, row, col, allowPath = false) {
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return false;
  const tile = grid[row][col];
  if (tile === TileType.CASTLE_WALL || tile === TileType.CASTLE_TOWER) return false;
  if (tile === TileType.PATH && !allowPath) return false;
  grid[row][col] = TileType.ENTRY;
  return true;
}

function segmentDirection(a, b) {
  const dc = b.col - a.col;
  const dr = b.row - a.row;
  if (dc === 0 && dr === 0) return null;
  return { dc, dr };
}

function directionsTurn(a, b) {
  if (!a || !b) return false;
  return (a.dc !== 0) !== (b.dc !== 0);
}

function previousDirection(sequence, index) {
  for (let i = index - 1; i >= 0; i--) {
    const dir = segmentDirection(sequence[i], sequence[index]);
    if (dir) return dir;
  }
  return null;
}

function nextDirection(sequence, index) {
  for (let i = index + 1; i < sequence.length; i++) {
    const dir = segmentDirection(sequence[index], sequence[i]);
    if (dir) return dir;
  }
  return null;
}

function buildMergeTargets(sequence, pathIdx) {
  const targets = new Map();

  for (let i = 0; i < sequence.length; i++) {
    const dir = nextDirection(sequence, i);
    if (!dir) continue;

    targets.set(`${sequence[i].col},${sequence[i].row},${dir.dc},${dir.dr}`, {
      col: sequence[i].col,
      row: sequence[i].row,
      dir,
      index: i,
      pathIdx,
      sequence,
    });
  }

  return targets;
}

function mergeRouteIntoExisting(sequence, mergeTargets) {
  if (!mergeTargets.size) return sequence;

  for (let i = 0; i < sequence.length; i++) {
    const curr = sequence[i];
    const dir = nextDirection(sequence, i);
    if (!curr || !dir) continue;

    const candidates = dir.dr === 0
      ? [
        { col: curr.col, row: curr.row - 1 },
        { col: curr.col, row: curr.row + 1 },
      ]
      : [
        { col: curr.col - 1, row: curr.row },
        { col: curr.col + 1, row: curr.row },
      ];

    for (const candidate of candidates) {
      const target = mergeTargets.get(`${candidate.col},${candidate.row},${dir.dc},${dir.dr}`);
      if (!target) continue;

      const merged = [
        ...sequence.slice(0, i + 1),
        { col: candidate.col, row: candidate.row },
        ...target.sequence.slice(target.index + 1),
      ];
      return dedupeSequence(merged);
    }
  }

  return sequence;
}

function footprintKey(row, col) {
  return `${col},${row}`;
}

function addFootprintCell(cells, row, col) {
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return;
  cells.set(footprintKey(row, col), { row, col });
}

function addTwoByTwoPathBlock(cells, tile) {
  const row = tile.row * TILE_SCALE;
  const col = tile.col * TILE_SCALE;

  addFootprintCell(cells, row, col);
  addFootprintCell(cells, row + 1, col);
  addFootprintCell(cells, row, col + 1);
  addFootprintCell(cells, row + 1, col + 1);
}

function markerCenterOffset() {
  return { dc: 1, dr: 1 };
}

function arrowDirectionAt(sequence, index) {
  const prevDir = previousDirection(sequence, index);
  const nextDir = nextDirection(sequence, index);
  if (directionsTurn(prevDir, nextDir)) {
    return {
      dc: prevDir.dc + nextDir.dc,
      dr: prevDir.dr + nextDir.dr,
    };
  }

  const next = sequence[index + 1];
  const curr = sequence[index];
  if (!curr) return null;

  const dir = next
    ? segmentDirection(curr, next)
    : previousDirection(sequence, index);
  if (!dir) return null;
  return { dc: dir.dc, dr: dir.dr };
}

function shouldDrawArrow(sequence, index) {
  return (
    index === 0 ||
    index === sequence.length - 1 ||
    directionsTurn(previousDirection(sequence, index), nextDirection(sequence, index))
  );
}

function buildTwoTileFootprint(sequence) {
  const cells = new Map();

  for (const tile of sequence) {
    addTwoByTwoPathBlock(cells, tile);
  }

  return cells;
}

function buildEntryFootprint(entry) {
  const cells = new Map();
  addTwoByTwoPathBlock(cells, entry);
  return cells;
}

function buildReservedEntryFootprints(entries) {
  const all = new Set();
  const byPath = [];

  for (let i = 0; i < entries.length; i++) {
    const footprint = buildEntryFootprint(entries[i]);
    byPath.push(new Set(footprint.keys()));
    for (const key of footprint.keys()) all.add(key);
  }

  return { all, byPath };
}

function buildCrossingFootprints(sequence, existingFootprints) {
  const crossing = new Set();

  for (const cell of buildTwoTileFootprint(sequence).values()) {
    const key = footprintKey(cell.row, cell.col);
    if (existingFootprints.has(key)) crossing.add(key);
  }

  return crossing;
}

function addPipeData(pipeData, sequence, crossingFootprints, pathIdx) {
  const crossingIndexes = [];
  for (let i = 0; i < sequence.length; i++) {
    const footprint = buildTwoTileFootprint([sequence[i]]);
    if ([...footprint.keys()].some(key => crossingFootprints.has(key))) crossingIndexes.push(i);
  }
  if (!crossingIndexes.length) return;

  const start = Math.max(0, Math.min(...crossingIndexes) - 1);
  const end = Math.min(sequence.length - 1, Math.max(...crossingIndexes) + 1);

  for (const [kind, tile] of [['in', sequence[start]], ['out', sequence[end]]]) {
    const index = kind === 'in' ? start : end;
    const nextDir = nextDirection(sequence, index);
    const prevDir = previousDirection(sequence, index);
    const dir = nextDir ?? prevDir;
    if (!dir) continue;

    const row = tile.row * TILE_SCALE;
    const col = tile.col * TILE_SCALE;
    pipeData.set(footprintKey(row, col), {
      row,
      col,
      kind,
      pathIdx,
      dc: dir.dc,
      dr: dir.dr,
    });
  }
}

function carveTwoTilePath(grid, sequence) {
  const cells = buildTwoTileFootprint(sequence);

  for (const cell of cells.values()) {
    setPath(grid, cell.row, cell.col);
  }
}

function markEntryMouth(grid, sequence) {
  const entry = sequence[0];
  if (!entry) return;

  const row = entry.row * TILE_SCALE;
  const col = entry.col * TILE_SCALE;
  setEntry(grid, row, col, true);
  setEntry(grid, row + 1, col, true);
  setEntry(grid, row, col + 1, true);
  setEntry(grid, row + 1, col + 1, true);

}

function hasRouteAt(grid, row, col) {
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return false;
  return isRouteTile(grid[row][col]);
}

function mergeUnseparatedPathGaps(grid) {
  const bridgeTargets = [];

  for (let r = 1; r < MAP_ROWS - 1; r++) {
    for (let c = 1; c < MAP_COLS - 1; c++) {
      const tile = grid[r][c];
      if (isRouteTile(tile)) continue;
      if (tile === TileType.CASTLE_WALL || tile === TileType.CASTLE_TOWER) continue;

      const verticalBridge = hasRouteAt(grid, r - 1, c) && hasRouteAt(grid, r + 1, c);
      const horizontalBridge = hasRouteAt(grid, r, c - 1) && hasRouteAt(grid, r, c + 1);
      if (verticalBridge || horizontalBridge) {
        bridgeTargets.push([r, c]);
      }
    }
  }

  for (const [r, c] of bridgeTargets) {
    setPath(grid, r, c);
  }
}

function growGrassAroundRoads(grid) {
  const grassTargets = [];

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const tile = grid[r][c];
      if (!isRouteTile(tile)) continue;

      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.abs(dc) + Math.abs(dr);
          if (dist > 3 || (dist === 3 && Math.random() < 0.45)) continue;
          grassTargets.push([r + dr, c + dc]);
        }
      }
    }
  }

  for (const [r, c] of grassTargets) setGrass(grid, r, c);
}

function fillTinyWaterGaps(grid) {
  const grassTargets = [];

  for (let r = 1; r < MAP_ROWS - 1; r++) {
    for (let c = 1; c < MAP_COLS - 1; c++) {
      if (grid[r][c] !== TileType.WATER) continue;

      let landNeighbors = 0;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (grid[r + dr][c + dc] !== TileType.WATER) landNeighbors++;
      }
      if (landNeighbors >= 3) grassTargets.push([r, c]);
    }
  }

  for (const [r, c] of grassTargets) setGrass(grid, r, c);
}

function isWalkableLandTile(tile) {
  return tile !== TileType.WATER;
}

function countNeighbors(grid, row, col, offsets, predicate) {
  let count = 0;

  for (const [dr, dc] of offsets) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) continue;
    if (predicate(grid[nr][nc], nr, nc)) count++;
  }

  return count;
}

function neighboringLandHeights(grid, heightmap, row, col) {
  const heights = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) continue;
      if (!isWalkableLandTile(grid[nr][nc])) continue;
      heights.push(heightmap[nr][nc]);
    }
  }

  return heights;
}

function naturalizeShoreline(grid, heightmap) {
  const cardinalOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const diagonalOffsets = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const allOffsets = [...cardinalOffsets, ...diagonalOffsets];
  const trimTargets = [];
  const growTargets = [];
  const widenTargets = [];
  const heightTargets = new Map();

  for (let r = 1; r < MAP_ROWS - 1; r++) {
    for (let c = 1; c < MAP_COLS - 1; c++) {
      const tile = grid[r][c];

      if (tile === TileType.GRASS) {
        const cardinalWater = countNeighbors(grid, r, c, cardinalOffsets, neighbor => neighbor === TileType.WATER);
        const diagonalWater = countNeighbors(grid, r, c, diagonalOffsets, neighbor => neighbor === TileType.WATER);
        if (cardinalWater + diagonalWater === 0) continue;

        const surroundingLand = countNeighbors(grid, r, c, allOffsets, neighbor => isWalkableLandTile(neighbor));
        if (cardinalWater >= 3 && surroundingLand <= 2) {
          trimTargets.push([r, c]);
          continue;
        }

        const prefersWidthBoost =
          cardinalWater === 1 ||
          (cardinalWater === 2 && surroundingLand <= 5 && Math.random() < 0.65) ||
          (diagonalWater >= 2 && Math.random() < 0.45);

        if (prefersWidthBoost) {
          for (const [dr, dc] of allOffsets) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr <= 0 || nr >= MAP_ROWS - 1 || nc <= 0 || nc >= MAP_COLS - 1) continue;
            if (grid[nr][nc] !== TileType.WATER) continue;

            const supportingLand = countNeighbors(grid, nr, nc, allOffsets, neighbor => isWalkableLandTile(neighbor));
            if (supportingLand >= 3 && Math.random() < 0.5) {
              widenTargets.push([nr, nc]);
            }
          }
        } else {
          let minCoastalHeight = cardinalWater >= 2 ? 3 : 2;
          if (diagonalWater >= 3 && surroundingLand >= 3) minCoastalHeight = Math.max(minCoastalHeight, 4);
          if (surroundingLand >= 6) minCoastalHeight = Math.min(minCoastalHeight + 1, 4);

          heightTargets.set(`${r},${c}`, Math.max(heightmap[r][c], minCoastalHeight));
        }
        continue;
      }

      if (tile !== TileType.WATER) continue;

      const cardinalLand = countNeighbors(grid, r, c, cardinalOffsets, neighbor => isWalkableLandTile(neighbor));
      const diagonalLand = countNeighbors(grid, r, c, diagonalOffsets, neighbor => isWalkableLandTile(neighbor));
      if (cardinalLand >= 3 || (cardinalLand >= 2 && diagonalLand >= 3)) {
        growTargets.push([r, c]);
      }
    }
  }

  for (const [r, c] of trimTargets) {
    grid[r][c] = TileType.WATER;
    heightTargets.delete(`${r},${c}`);
  }

  for (const [r, c] of growTargets) {
    grid[r][c] = TileType.GRASS;
    const neighborHeights = neighboringLandHeights(grid, heightmap, r, c);
    const baseHeight = neighborHeights.length
      ? Math.max(2, Math.min(3, Math.max(...neighborHeights) - 1))
      : 2;
    heightTargets.set(`${r},${c}`, Math.max(heightmap[r][c], baseHeight));
  }

  for (const [r, c] of widenTargets) {
    if (grid[r][c] !== TileType.WATER) continue;
    grid[r][c] = TileType.GRASS;
    const neighborHeights = neighboringLandHeights(grid, heightmap, r, c);
    const baseHeight = neighborHeights.length
      ? Math.max(1, Math.min(2, Math.max(...neighborHeights) - 1))
      : 1;
    heightTargets.set(`${r},${c}`, Math.max(heightmap[r][c], baseHeight));
  }

  for (const [key, targetHeight] of heightTargets) {
    const [r, c] = key.split(',').map(Number);
    if (grid[r][c] !== TileType.GRASS) continue;
    heightmap[r][c] = Math.max(heightmap[r][c], targetHeight);
  }
}

function generateHeightmap(cols, rows) {
  const hmap = Array.from({ length: rows }, () => new Array(cols).fill(1));
  const numHills = rng(6, 12);
  for (let i = 0; i < numHills; i++) {
    const hc = rng(2, cols - 3);
    const hr = rng(2, rows - 3);
    const peak = rng(2, 4);
    const radius = rng(3, 7);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dist = Math.sqrt((c - hc) ** 2 + (r - hr) ** 2);
        if (dist < radius) {
          const h = Math.max(1, Math.round(peak * (1 - dist / radius)));
          if (h > hmap[r][c]) hmap[r][c] = h;
        }
      }
    }
  }
  return hmap;
}

function blendRouteHeights(grid, heightmap, iterations = 2) {
  for (let pass = 0; pass < iterations; pass++) {
    const next = heightmap.map(row => [...row]);

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        if (!isRouteTile(grid[r][c])) continue;

        const samples = [heightmap[r][c]];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) continue;
            if (!isWalkableLandTile(grid[nr][nc])) continue;
            samples.push(heightmap[nr][nc]);
          }
        }

        const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
        next[r][c] = clamp(Math.round(average), 1, 4);
      }
    }

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        heightmap[r][c] = next[r][c];
      }
    }
  }
}

export function generateMap(options) {
  const { numPaths, minPathLength, maxPathLength } = normalizeOptions(options);
  const lengthRules = normalizeLengthRules({ minPathLength, maxPathLength });
  const grid = Array.from({ length: MAP_ROWS }, () =>
    new Array(MAP_COLS).fill(TileType.WATER)
  );

  const castleCol = Math.floor(COARSE_COLS * 0.76);
  const castleRow = Math.floor(COARSE_ROWS * 0.22);
  const castleFinalCol = castleCol * TILE_SCALE;
  const castleFinalRow = castleRow * TILE_SCALE;

  // Castle sits on a large island
  spawnPlatform(grid, castleFinalCol, castleFinalRow, rng(20, 26), rng(16, 22));
  placeCastle(grid, castleFinalCol, castleFinalRow);

  const allEntries = [
    { col: 0, row: Math.floor(COARSE_ROWS * 0.15) },
    { col: 0, row: Math.floor(COARSE_ROWS * 0.50) },
    { col: 0, row: Math.floor(COARSE_ROWS * 0.78) },
    { col: Math.floor(COARSE_COLS * 0.25), row: COARSE_ROWS - 1 },
    { col: Math.floor(COARSE_COLS * 0.55), row: COARSE_ROWS - 1 },
  ];

  const requestedPaths = Number.isFinite(numPaths)
    ? Math.round(numPaths)
    : rng(DEFAULT_MIN_PATHS, DEFAULT_MAX_PATHS);
  const n = clamp(requestedPaths, 1, allEntries.length);
  const shuffled = [...allEntries].sort(() => Math.random() - 0.5);
  const entries = shuffled.slice(0, n);
  const castleCenter = {
    col: clamp(castleCol - 2, 1, COARSE_COLS - 2),
    row: castleRow,
  };

  // Each entry gets its own island; shift center inward so the platform is fully on the map
  for (const e of entries) {
    const pc = clamp(e.col === 0 ? e.col + 2 : e.col, 2, COARSE_COLS - 3) * TILE_SCALE;
    const pr = clamp(e.row === COARSE_ROWS - 1 ? e.row - 2 : e.row, 2, COARSE_ROWS - 3) * TILE_SCALE;
    spawnPlatform(grid, pc, pr, rng(8, 14), rng(6, 12));
  }

  // Scatter intermediate islands across the map to break up open water
  for (let i = 0; i < rng(5, 9); i++) {
    spawnPlatform(
      grid,
      rng(3, COARSE_COLS - 4) * TILE_SCALE,
      rng(3, COARSE_ROWS - 4) * TILE_SCALE,
      rng(6, 14),
      rng(6, 12)
    );
  }

  const arrowData = new Map();
  const paths = [];
  const blockedCenterlines = new Set();
  const blockedFootprints = new Set();
  const pipeData = new Map();
  const mergeTargets = new Map();
  const reservedEntries = buildReservedEntryFootprints(entries);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const route = createRoute(
      entry,
      castleCenter,
      lengthRules,
      blockedCenterlines,
      blockedFootprints,
      reservedEntries.all,
      reservedEntries.byPath[i]
    );
    const sequence = mergeRouteIntoExisting(route.sequence, mergeTargets);
    const length = routeLength(sequence);
    const conflicts = routeConflictCount(
      sequence,
      blockedCenterlines,
      blockedFootprints,
      reservedEntries.all,
      reservedEntries.byPath[i]
    );
    const crossingFootprints = buildCrossingFootprints(sequence, blockedFootprints);
    carveTwoTilePath(grid, sequence);
    addPipeData(pipeData, sequence, crossingFootprints, i);

    markEntryMouth(grid, sequence);
    paths.push({ entry, waypoints: route.waypoints, length, conflicts, pathIdx: i });

    const safeSequence = protectedSequence(sequence);
    for (const tile of safeSequence) {
      blockedCenterlines.add(tileKey(tile));
    }
    for (const cell of buildTwoTileFootprint(safeSequence).values()) {
      blockedFootprints.add(footprintKey(cell.row, cell.col));
    }
    for (const [key, target] of buildMergeTargets(sequence, i)) {
      if (!mergeTargets.has(key)) mergeTargets.set(key, target);
    }

    for (let j = 0; j < sequence.length; j++) {
      const curr = sequence[j];
      const markerRow = curr.row * TILE_SCALE;
      const markerCol = curr.col * TILE_SCALE;
      const currType = grid[markerRow]?.[markerCol];
      if (!isRouteTile(currType)) continue;

      const arrow = arrowDirectionAt(sequence, j);
      if (!arrow) continue;
      const { dc, dr } = arrow;
      const side = markerCenterOffset();
      const key = `${markerCol},${markerRow}`;

      if (!arrowData.has(key)) arrowData.set(key, []);
      const list = arrowData.get(key);
      if (!list.some(e => e.pathIdx === i)) {
        list.push({
          dc,
          dr,
          sideDc: side.dc,
          sideDr: side.dr,
          marker: shouldDrawArrow(sequence, j) ? 'arrow' : 'dot',
          pathIdx: i,
        });
      }
    }
  }

  mergeUnseparatedPathGaps(grid);
  growGrassAroundRoads(grid);
  fillTinyWaterGaps(grid);

  const heightmap = generateHeightmap(MAP_COLS, MAP_ROWS);
  naturalizeShoreline(grid, heightmap);
  blendRouteHeights(grid, heightmap);

  return { grid, heightmap, cols: MAP_COLS, rows: MAP_ROWS, entries, castlePos: castleCenter, numPaths: n, paths, arrowData, pipeData };
}
