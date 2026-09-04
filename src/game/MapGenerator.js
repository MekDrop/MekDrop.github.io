import {
  CastleEntrancePathMissingError,
  DisconnectedTerrainError,
  EntryPathUnreachableError,
  GatePathMissingError,
  GateRouteMissingError,
  InsufficientCastleClearanceError,
  InsufficientEntryPathSpacingError,
  InsufficientLayoutVarietyError,
  InsufficientParallelPathSpacingError,
  InsufficientVegetationVarietyError,
  InvalidCastleEntranceWidthError,
  InvalidGatePositionError,
  InvalidGroundCoverPlacementError,
  InvalidRouteWaypointError,
  InvalidVegetationPlacementError,
  IsolatedGrassElevationError,
  NoPlayableTerrainError,
  NonOrthogonalRouteSegmentError,
  PathHeightMismatchError,
  PathOutsideGateError,
} from './errors/map/index.js';

export const TileType = {
  WATER: 0,
  GRASS: 1,
  PATH: 2,
  CASTLE_WALL: 3,
  CASTLE_TOWER: 4,
  ENTRY: 5,
};

export class MapGenerator {
  static #MAP_COLS = 42;
  static #MAP_ROWS = 42;
  static #DEFAULT_MIN_PATHS = 2;
  static #DEFAULT_MAX_PATHS = 4;
  static #LEFT_GATE_COL = 4;
  static #RIGHT_GATE_COL = this.#MAP_COLS - 1 - this.#LEFT_GATE_COL;
  static #PATH_HEIGHT = 2;
  static #FOUNDATION_HEIGHT = 3;
  static #WATER_HEIGHT = 0;
  static #CASTLE_GROUND_CLEARANCE = 3;
  static #CASTLE_REAR_GROUND_CLEARANCE = 1;
  static #CASTLE_OCCUPANTS = ['king', 'queen', 'princess'];
  static #TREE_VARIANTS = ['oak', 'pine', 'tall-tree', 'sapling'];
  static #BUSH_VARIANTS = ['round-bush', 'wide-bush'];
  static #GROUND_COVER_VARIANTS = [
    'daisy-patch',
    'buttercup-patch',
    'pink-flower-patch',
    'blue-flower-patch',
    'clover-patch',
    'red-mushroom',
    'golden-mushroom-pair',
    'forest-mushroom-cluster',
  ];
  static #FLOWER_PATCH_VARIANTS = [
    'daisy-patch',
    'buttercup-patch',
    'pink-flower-patch',
    'blue-flower-patch',
    'clover-patch',
  ];
  static #MUSHROOM_PATCH_VARIANTS = [
    'red-mushroom',
    'golden-mushroom-pair',
    'forest-mushroom-cluster',
  ];
  static #VEGETATION_VARIANTS = [
    ...this.#TREE_VARIANTS,
    ...this.#BUSH_VARIANTS,
  ];
  static #CASTLE_FOOTPRINTS = [
    { width: 5, depth: 7, style: 'twin-tower' },
    { width: 6, depth: 7, style: 'right-angle' },
    { width: 5, depth: 7, style: 'single-tower' },
    { width: 6, depth: 7, style: 'left-angle' },
  ];
  static #TILE_SHAPE = {
    FLAT: 'FLAT',
  };
  static #DIRECTIONS = {
    NORTH: 'NORTH',
    EAST: 'EAST',
    SOUTH: 'SOUTH',
    WEST: 'WEST',
    NONE: 'NONE',
  };
  static #ENTRY_TEMPLATES = [
    { id: 'north', gateRows: [5, 6], mergeRange: [18, 24] },
    { id: 'upper', gateRows: [10, 11], mergeRange: [14, 20] },
    { id: 'lower', gateRows: [19, 20], mergeRange: [11, 18] },
    { id: 'south', gateRows: [25, 26], mergeRange: [13, 20] },
  ];

  static generate(options) {
    const { numPaths: requestedNumPaths } = this.#normalizeOptions(options);
    const numPaths = this.#clamp(
      Number.isFinite(requestedNumPaths)
        ? Math.round(requestedNumPaths)
        : this.#rng(this.#DEFAULT_MIN_PATHS, this.#DEFAULT_MAX_PATHS),
      1,
      this.#ENTRY_TEMPLATES.length,
    );
    const layout = this.#createLayoutConfig(numPaths);
    const grid = this.#createGrid(TileType.WATER);
    const tileMeta = this.#createTileMetadata();
    const islandMask = this.#buildIslandMask(layout);

    this.#materializeIsland(grid, tileMeta, islandMask);
    const { mergeZones, routeCellsByPath, trunkStart } = this.#carvePaths(grid, tileMeta, layout);
    this.#placeCastle(grid, tileMeta, layout);

    const heightmap = this.#buildHeightmap(grid, layout);
    this.#applyHeightsToMetadata(grid, tileMeta, heightmap);
    const vegetationData = this.#placeVegetation(
      grid,
      heightmap,
      tileMeta,
      layout,
    );
    const groundCoverData = this.#placeGroundCover(
      grid,
      heightmap,
      tileMeta,
      vegetationData,
    );
    this.#validateMap(
      grid,
      heightmap,
      tileMeta,
      layout,
      vegetationData,
      groundCoverData,
    );
    const { routes, arrowData } = this.#buildRouteData(layout);
    const castle = this.#buildCastleData(grid, layout);

    return {
      grid,
      heightmap,
      tileMeta,
      cols: this.#MAP_COLS,
      rows: this.#MAP_ROWS,
      entries: layout.entries.map(entry => ({
        col: entry.gateCol,
        row: entry.gateRows[0],
        rows: [...entry.gateRows],
        side: entry.side,
      })),
      castlePos: { col: layout.castleLeft, row: layout.pathRows[0] },
      castle,
      numPaths: layout.entries.length,
      paths: routeCellsByPath.map((path, pathIdx) => ({
        ...path,
        route: routes[pathIdx],
      })),
      arrowData,
      vegetationData,
      groundCoverData,
      pipeData: new Map(),
      mergeZones,
      trunkStart,
      layoutSignature: layout.signature,
    };
  }

  static #rng(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static #clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  static #randomItem(items) {
    return items[this.#rng(0, items.length - 1)];
  }

  static #shuffle(items) {
    for (let index = items.length - 1; index > 0; index--) {
      const swapIndex = this.#rng(0, index);
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
  }

  static #normalizeOptions(options) {
    if (typeof options === 'number') return { numPaths: options };
    return options ?? {};
  }

  static #tileKey(col, row) {
    return `${col},${row}`;
  }

  static #createGrid(fillValue) {
    return Array.from({ length: this.#MAP_ROWS }, () => new Array(this.#MAP_COLS).fill(fillValue));
  }

  static #createTileMetadata() {
    return Array.from({ length: this.#MAP_ROWS }, (_, row) =>
      Array.from({ length: this.#MAP_COLS }, (_, col) => ({
        x: col,
        y: row,
        baseHeight: this.#WATER_HEIGHT,
        surfaceType: 'WATER',
        shape: this.#TILE_SHAPE.FLAT,
        direction: this.#DIRECTIONS.NONE,
        renderMode: 'SOLID',
      }))
    );
  }

  static #createLayoutConfig(numPaths) {
    const anchorRows = this.#ENTRY_TEMPLATES.map(template => [...template.gateRows]);
    const pathRows = anchorRows[this.#rng(0, anchorRows.length - 1)];
    const castleFootprintIndex = numPaths >= 4 ? 1 : numPaths === 3 ? 2 : pathRows[0] <= 6 || pathRows[1] >= 25 ? 0 : 3;
    const castleFootprint = this.#CASTLE_FOOTPRINTS[castleFootprintIndex];
    // Keep the castle against the rear of its buildable plateau. The footprint
    // still varies by width and row, while the required grass clearance remains
    // between the back wall and the island edge.
    const castleRight =
      this.#MAP_COLS - this.#CASTLE_REAR_GROUND_CLEARANCE - 2;
    const castleLeft = castleRight - castleFootprint.width + 1;
    const castleCenterRow = pathRows[1];
    const castleTop = pathRows[0] - Math.floor((castleFootprint.depth - 2) / 2);
    const castleBottom = castleTop + castleFootprint.depth - 1;
    const castleEntranceRows = [...pathRows];
    const entries = this.#selectEntries(numPaths, castleLeft, castleTop, castleBottom, pathRows);
    const islandEllipses = [
      {
        centerCol: this.#rng(20, 24),
        centerRow: this.#clamp(castleCenterRow + this.#rng(-2, 2), 11, 28),
        radiusX: this.#rng(15, 19),
        radiusY: this.#rng(10, 13),
      },
      {
        centerCol: this.#rng(12, 18),
        centerRow: this.#clamp(castleCenterRow + this.#rng(-4, 1), 10, 24),
        radiusX: this.#rng(9, 13),
        radiusY: this.#rng(7, 10),
      },
      {
        centerCol: this.#rng(11, 18),
        centerRow: this.#clamp(castleCenterRow + this.#rng(6, 12), 19, 32),
        radiusX: this.#rng(8, 12),
        radiusY: this.#rng(5, 8),
      },
      {
        centerCol: this.#clamp(castleLeft + this.#rng(1, 5), 26, 35),
        centerRow: this.#clamp(castleCenterRow + this.#rng(-3, 1), 10, 27),
        radiusX: this.#rng(8, 11),
        radiusY: this.#rng(6, 9),
      },
    ];
    const hillEllipses = [
      { centerCol: this.#rng(18, 24), centerRow: this.#clamp(castleCenterRow + this.#rng(-1, 2), 11, 28), radiusX: 13, radiusY: 9, height: 2 },
      { centerCol: this.#clamp(castleLeft + 2, 20, 34), centerRow: this.#clamp(castleCenterRow + this.#rng(-1, 1), 11, 28), radiusX: 8, radiusY: 6, height: 3 },
      { centerCol: this.#rng(12, 18), centerRow: this.#clamp(castleCenterRow + this.#rng(7, 10), 20, 33), radiusX: 8, radiusY: 5, height: 2 },
    ];

    return {
      castleLeft,
      castleRight,
      castleTop,
      castleBottom,
      castleCenterRow,
      castleFootprint,
      castleEntranceCol: castleLeft,
      pathRows,
      castleEntranceRows,
      entries,
      islandEllipses,
      hillEllipses,
      signature: JSON.stringify({
        castleLeft,
        castleCenterRow,
        castleFootprint,
        entries: entries.map(entry => ({ id: entry.id, side: entry.side, mergeCol: entry.mergeCol })),
        trunkStart: Math.min(...entries.map(entry => entry.mergeCol)),
        ellipses: islandEllipses,
      }),
    };
  }

  static #inBounds(col, row) {
    return col >= 0 && col < this.#MAP_COLS && row >= 0 && row < this.#MAP_ROWS;
  }

  static #setTile(grid, tileMeta, col, row, type, overrides = {}) {
    if (!this.#inBounds(col, row)) return;
    grid[row][col] = type;
    tileMeta[row][col] = {
      ...tileMeta[row][col],
      surfaceType: overrides.surfaceType ?? tileMeta[row][col].surfaceType,
      baseHeight: overrides.baseHeight ?? tileMeta[row][col].baseHeight,
      shape: overrides.shape ?? tileMeta[row][col].shape,
      direction: overrides.direction ?? tileMeta[row][col].direction,
    };
  }

  static #fillRect(grid, tileMeta, left, top, right, bottom, type, overrides = {}) {
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        this.#setTile(grid, tileMeta, col, row, type, overrides);
      }
    }
  }

  static #addEllipse(mask, centerCol, centerRow, radiusX, radiusY) {
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        const dx = (col - centerCol) / radiusX;
        const dy = (row - centerRow) / radiusY;
        if (dx * dx + dy * dy <= 1) {
          mask[row][col] = true;
        }
      }
    }
  }

  static #fillMaskRect(mask, left, top, right, bottom) {
    for (let row = Math.max(0, top); row <= Math.min(this.#MAP_ROWS - 1, bottom); row++) {
      for (let col = Math.max(0, left); col <= Math.min(this.#MAP_COLS - 1, right); col++) {
        mask[row][col] = true;
      }
    }
  }

  static #buildIslandMask(layout) {
    const mask = Array.from({ length: this.#MAP_ROWS }, () => new Array(this.#MAP_COLS).fill(false));

    for (const ellipse of layout.islandEllipses) {
      this.#addEllipse(mask, ellipse.centerCol, ellipse.centerRow, ellipse.radiusX, ellipse.radiusY);
    }

    for (const entry of layout.entries) {
      const [topRow, bottomRow] = entry.gateRows;
      const corridorLeft = Math.min(entry.gateCol, entry.mergeCol);
      const corridorRight = Math.max(entry.gateCol, entry.mergeCol + 1);
      this.#fillMaskRect(mask, corridorLeft, topRow - 1, corridorRight, bottomRow + 1);

      if (entry.curvePlan) {
        const curveBands = [entry.gateRows, ...entry.curvePlan.bands, [layout.pathRows[0], layout.pathRows[1]]];
        const minTop = Math.min(...curveBands.map(rows => rows[0]));
        const maxBottom = Math.max(...curveBands.map(rows => rows[1]));
        this.#fillMaskRect(mask, corridorLeft, minTop - 1, corridorRight, maxBottom + 1);
      }

      for (const row of entry.gateRows) {
        if (entry.inwardDirection === this.#DIRECTIONS.EAST) {
          for (let col = 0; col < entry.gateCol; col++) {
            mask[row][col] = false;
          }
        } else {
          for (let col = entry.gateCol + 1; col < this.#MAP_COLS; col++) {
            mask[row][col] = false;
          }
        }
      }
    }

    this.#fillMaskRect(mask, 10, layout.pathRows[0] - 2, layout.castleLeft + 1, layout.pathRows[1] + 2);
    this.#fillMaskRect(
      mask,
      layout.castleLeft - this.#CASTLE_GROUND_CLEARANCE,
      layout.castleTop - this.#CASTLE_GROUND_CLEARANCE,
      layout.castleRight + this.#CASTLE_REAR_GROUND_CLEARANCE,
      layout.castleBottom + this.#CASTLE_GROUND_CLEARANCE
    );

    for (const entry of layout.entries) {
      for (const row of entry.gateRows) {
        if (entry.inwardDirection === this.#DIRECTIONS.EAST) {
          for (let col = 0; col < entry.gateCol; col++) {
            mask[row][col] = false;
          }
        } else {
          for (let col = entry.gateCol + 1; col < this.#MAP_COLS; col++) {
            mask[row][col] = false;
          }
        }
      }
    }

    // End the local plateau immediately after the rear grass buffer. Entry
    // corridors cannot overlap this band, so this keeps the castle close to
    // the cliff without removing a valid gate approach.
    for (
      let row = layout.castleTop - this.#CASTLE_GROUND_CLEARANCE;
      row <= layout.castleBottom + this.#CASTLE_GROUND_CLEARANCE;
      row++
    ) {
      for (
        let col =
          layout.castleRight + this.#CASTLE_REAR_GROUND_CLEARANCE + 1;
        col < this.#MAP_COLS;
        col++
      ) {
        if (this.#inBounds(col, row)) mask[row][col] = false;
      }
    }

    return mask;
  }

  static #materializeIsland(grid, tileMeta, islandMask) {
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        if (!islandMask[row][col]) continue;
        this.#setTile(grid, tileMeta, col, row, TileType.GRASS, {
          surfaceType: 'GRASS',
          baseHeight: 1,
        });
      }
    }
  }

  static #rowsOverlap(rows, top, bottom) {
    return rows[0] <= bottom && rows[1] >= top;
  }

  static #selectEntries(numPaths, castleLeft, castleTop, castleBottom, pathRows) {
    const requested = Number.isFinite(numPaths)
      ? Math.round(numPaths)
      : this.#rng(this.#DEFAULT_MIN_PATHS, this.#DEFAULT_MAX_PATHS);
    const count = this.#clamp(requested, 1, this.#ENTRY_TEMPLATES.length);
    const shuffled = [...this.#ENTRY_TEMPLATES].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count).sort((a, b) => a.gateRows[0] - b.gateRows[0]);
    const sharedMinMerge = Math.max(...selected.map(template => template.mergeRange[0]));
    const sharedMaxMerge = Math.min(castleLeft - 6, ...selected.map(template => template.mergeRange[1]));
    const mergeCol = this.#rng(sharedMinMerge, sharedMaxMerge);
    const sides = selected.map(template => {
      if (this.#rowsOverlap(template.gateRows, castleTop - 3, castleBottom + 3)) {
        return 'LEFT';
      }
      return this.#rng(0, 1) === 0 ? 'LEFT' : 'RIGHT';
    });

    if (selected.length > 1 && sides.every(side => side === sides[0])) {
      const candidateIndexes = selected
        .map((template, index) => ({ template, index }))
        .filter(({ template }) => !this.#rowsOverlap(template.gateRows, castleTop - 3, castleBottom + 3))
        .map(({ index }) => index);

      if (candidateIndexes.length) {
        const flipIndex = candidateIndexes[this.#rng(0, candidateIndexes.length - 1)];
        sides[flipIndex] = sides[0] === 'LEFT' ? 'RIGHT' : 'LEFT';
      }
    }

    return selected.map((template, index) => {
      const side = sides[index];
      const entry = {
        ...template,
        side,
        gateCol: side === 'LEFT' ? this.#LEFT_GATE_COL : this.#RIGHT_GATE_COL,
        inwardDirection: side === 'LEFT' ? this.#DIRECTIONS.EAST : this.#DIRECTIONS.WEST,
        mergeCol,
      };
      return {
        ...entry,
        curvePlan: this.#buildCurvePlan(entry, pathRows, mergeCol, selected.map(candidate => candidate.gateRows[0])),
      };
    });
  }

  static #buildCurvePlan(entry, pathRows, mergeCol, occupiedBandStarts) {
    const [topRow, bottomRow] = entry.gateRows;
    const [trunkTop, trunkBottom] = pathRows;
    const safeBands = bottomRow < trunkTop
      ? this.#collectSafeCurveBandStarts(bottomRow + 1, trunkTop - 4, occupiedBandStarts, pathRows[0], 1)
      : topRow > trunkBottom
        ? this.#collectSafeCurveBandStarts(trunkBottom + 3, topRow - 2, occupiedBandStarts, pathRows[0], -1)
        : [];

    if (!safeBands.length) return null;

    const bandStarts = this.#selectCurveBandStarts(safeBands);
    const turnCols = this.#pickCurveTurnCols(entry.side, entry.gateCol, mergeCol, bandStarts.length);
    if (!turnCols.length) return null;

    return {
      turnCols,
      bands: bandStarts.slice(0, turnCols.length).map(start => [start, start + 1]),
    };
  }

  static #collectSafeCurveBandStarts(min, max, occupiedBandStarts, trunkTop, direction) {
    if (min > max) return [];

    const blocked = occupiedBandStarts.concat(trunkTop);
    const candidates = [];
    if (direction > 0) {
      for (let start = min; start <= max; start++) candidates.push(start);
    } else {
      for (let start = max; start >= min; start--) candidates.push(start);
    }

    const safe = [];
    for (const candidate of candidates) {
      if (!blocked.every(start => Math.abs(candidate - start) >= 4)) continue;
      if (!safe.every(start => Math.abs(candidate - start) >= 4)) continue;
      safe.push(candidate);
    }

    if (safe.length >= 2) {
      return [safe[0], safe[safe.length - 1]];
    }

    return safe;
  }

  static #selectCurveBandStarts(safeBands) {
    if (safeBands.length >= 3) {
      const midIndex = Math.floor(safeBands.length / 2);
      return [safeBands[0], safeBands[midIndex], safeBands[safeBands.length - 1]];
    }
    if (safeBands.length >= 2) {
      return [safeBands[0], safeBands[safeBands.length - 1]];
    }
    return safeBands.slice(0, 1);
  }

  static #pickCurveTurnCols(side, gateCol, mergeCol, requestedCount) {
    if (side === 'LEFT') {
      const width = mergeCol - gateCol;
      const outerNearGate = gateCol + 3;
      const farInland = mergeCol - 3;
      const returnCol = gateCol + Math.max(6, Math.floor(width * 0.42));

      if (requestedCount >= 3 && outerNearGate <= farInland - 8 && returnCol >= outerNearGate + 4 && returnCol <= farInland - 4) {
        return [outerNearGate, farInland, returnCol];
      }
      if (requestedCount >= 2) {
        const first = farInland;
        const second = gateCol + Math.max(5, Math.floor(width * 0.38));
        if (first >= second + 4 && second <= mergeCol - 4) {
          return [first, second];
        }
      }
      return outerNearGate <= mergeCol - 4 ? [outerNearGate] : [];
    }

    const width = gateCol - mergeCol;
    const outerNearGate = gateCol - 4;
    const farInland = mergeCol + 2;
    const returnCol = gateCol - Math.max(6, Math.floor(width * 0.42));

    if (requestedCount >= 3 && farInland <= outerNearGate - 8 && returnCol <= outerNearGate - 4 && returnCol >= farInland + 4) {
      return [outerNearGate, farInland, returnCol];
    }
    if (requestedCount >= 2) {
      const first = farInland;
      const second = gateCol - Math.max(5, Math.floor(width * 0.38));
      if (first <= second - 4 && second >= mergeCol + 3) {
        return [first, second];
      }
    }
    return outerNearGate >= mergeCol + 3 ? [outerNearGate] : [];
  }

  static #drawHorizontalPath(grid, tileMeta, startCol, endCol, rows, direction = null, type = TileType.PATH) {
    const left = Math.min(startCol, endCol);
    const right = Math.max(startCol, endCol);
    const horizontalDirection = direction ?? (startCol <= endCol ? this.#DIRECTIONS.EAST : this.#DIRECTIONS.WEST);

    for (const row of rows) {
      this.#fillRect(grid, tileMeta, left, row, right, row, type, {
        surfaceType: type === TileType.ENTRY ? 'STRUCTURE' : 'PATH',
        baseHeight: this.#PATH_HEIGHT,
        direction: horizontalDirection,
      });
    }
  }

  static #drawVerticalPath(grid, tileMeta, colLeft, top, bottom) {
    const low = Math.min(top, bottom);
    const high = Math.max(top, bottom);
    this.#fillRect(grid, tileMeta, colLeft, low, colLeft + 1, high, TileType.PATH, {
      surfaceType: 'PATH',
      baseHeight: this.#PATH_HEIGHT,
      direction: top <= bottom ? this.#DIRECTIONS.SOUTH : this.#DIRECTIONS.NORTH,
    });
  }

  static #addHorizontalRoute(grid, tileMeta, cells, startCol, endCol, rows, direction = null) {
    this.#drawHorizontalPath(grid, tileMeta, startCol, endCol, rows, direction);
    const left = Math.min(startCol, endCol);
    const right = Math.max(startCol, endCol);
    for (let col = left; col <= right; col++) {
      for (const row of rows) {
        cells.add(this.#tileKey(col, row));
      }
    }
  }

  static #addVerticalRoute(grid, tileMeta, cells, colLeft, top, bottom) {
    this.#drawVerticalPath(grid, tileMeta, colLeft, top, bottom);
    const low = Math.min(top, bottom);
    const high = Math.max(top, bottom);
    for (let row = low; row <= high; row++) {
      cells.add(this.#tileKey(colLeft, row));
      cells.add(this.#tileKey(colLeft + 1, row));
    }
  }

  static #addVerticalRouteBetweenBands(grid, tileMeta, cells, colLeft, firstRows, secondRows) {
    const top = Math.min(firstRows[0], secondRows[0]);
    const bottom = Math.max(firstRows[1], secondRows[1]);
    this.#addVerticalRoute(grid, tileMeta, cells, colLeft, top, bottom);
  }

  static #carvePaths(grid, tileMeta, layout) {
    const mergeZones = new Set();
    const routeCellsByPath = [];
    const trunkStart = Math.min(...layout.entries.map(entry => entry.mergeCol));

    this.#drawHorizontalPath(
      grid,
      tileMeta,
      trunkStart,
      layout.castleEntranceCol,
      layout.pathRows,
      this.#DIRECTIONS.EAST
    );

    for (let pathIdx = 0; pathIdx < layout.entries.length; pathIdx++) {
      const entry = layout.entries[pathIdx];
      const [topRow, bottomRow] = entry.gateRows;
      const cells = new Set();

      for (const row of entry.gateRows) {
        this.#setTile(grid, tileMeta, entry.gateCol, row, TileType.ENTRY, {
          surfaceType: 'STRUCTURE',
          baseHeight: this.#PATH_HEIGHT,
          direction: entry.inwardDirection,
        });
        cells.add(this.#tileKey(entry.gateCol, row));
      }

      if (entry.curvePlan) {
        const { bands, turnCols } = entry.curvePlan;
        const firstEnd = entry.inwardDirection === this.#DIRECTIONS.EAST ? turnCols[0] + 1 : turnCols[0];
        this.#addHorizontalRoute(grid, tileMeta, cells, entry.inwardDirection === this.#DIRECTIONS.EAST ? entry.gateCol + 1 : entry.gateCol - 1, firstEnd, entry.gateRows, entry.inwardDirection);
        this.#addVerticalRouteBetweenBands(grid, tileMeta, cells, turnCols[0], entry.gateRows, bands[0]);

        for (let index = 0; index < bands.length; index++) {
          const startCol = turnCols[index];
          const endCol = index + 1 < turnCols.length
            ? entry.inwardDirection === this.#DIRECTIONS.EAST ? turnCols[index + 1] + 1 : turnCols[index + 1]
            : entry.inwardDirection === this.#DIRECTIONS.EAST ? entry.mergeCol + 1 : entry.mergeCol;
          this.#addHorizontalRoute(grid, tileMeta, cells, startCol, endCol, bands[index], entry.inwardDirection);

          if (index + 1 < bands.length) {
            this.#addVerticalRouteBetweenBands(
              grid,
              tileMeta,
              cells,
              turnCols[index + 1],
              bands[index],
              bands[index + 1],
            );
          }
        }

        const finalBand = bands[bands.length - 1];
        if (bottomRow < layout.pathRows[0]) {
          this.#addVerticalRoute(grid, tileMeta, cells, entry.mergeCol, finalBand[0], layout.pathRows[1]);
        } else {
          this.#addVerticalRoute(grid, tileMeta, cells, entry.mergeCol, layout.pathRows[0], finalBand[1]);
        }
      } else {
        const horizontalStart = entry.inwardDirection === this.#DIRECTIONS.EAST ? entry.gateCol + 1 : entry.gateCol - 1;
        const horizontalEnd = entry.inwardDirection === this.#DIRECTIONS.EAST ? entry.mergeCol + 1 : entry.mergeCol;
        this.#addHorizontalRoute(grid, tileMeta, cells, horizontalStart, horizontalEnd, entry.gateRows, entry.inwardDirection);

        if (bottomRow < layout.pathRows[0]) {
          this.#addVerticalRoute(grid, tileMeta, cells, entry.mergeCol, topRow, layout.pathRows[1]);
        } else if (topRow > layout.pathRows[1]) {
          this.#addVerticalRoute(grid, tileMeta, cells, entry.mergeCol, layout.pathRows[0], bottomRow);
        }
      }

      for (let col = entry.mergeCol; col <= entry.mergeCol + 1; col++) {
        for (const row of layout.pathRows) {
          mergeZones.add(this.#tileKey(col, row));
        }
      }

      routeCellsByPath.push({
        pathIdx,
        entry: { col: entry.gateCol, rows: [...entry.gateRows], side: entry.side },
        mergeCol: entry.mergeCol,
        gateRows: [...entry.gateRows],
        routeCells: cells,
      });
    }

    return { mergeZones, routeCellsByPath, trunkStart };
  }

  static #placeCastle(grid, tileMeta, layout) {
    for (let row = layout.castleTop; row <= layout.castleBottom; row++) {
      for (let col = layout.castleLeft; col <= layout.castleRight; col++) {
        const isCorner =
          (row === layout.castleTop || row === layout.castleBottom) &&
          (col === layout.castleLeft || col === layout.castleRight);
        const isEntrance = col === layout.castleEntranceCol && layout.castleEntranceRows.includes(row);

        if (isEntrance) {
          this.#setTile(grid, tileMeta, col, row, TileType.PATH, {
            surfaceType: 'PATH',
            baseHeight: this.#PATH_HEIGHT,
            direction: this.#DIRECTIONS.EAST,
          });
          continue;
        }

        this.#setTile(grid, tileMeta, col, row, isCorner ? TileType.CASTLE_TOWER : TileType.CASTLE_WALL, {
          surfaceType: 'STRUCTURE',
          baseHeight: this.#FOUNDATION_HEIGHT,
        });
      }
    }
  }

  static #buildCastleData(grid, layout) {
    const doors = [];
    const collectGate = (side, cells, inwardDirection, outsideColOffset, outsideRowOffset) => {
      if (!cells.length) return;

      let run = [];
      const flushRun = () => {
        if (!run.length) return;
        const verticalSide = side === 'WEST' || side === 'EAST';
        doors.push({
          side,
          offset: (verticalSide ? run[0].row : run[0].col) - (verticalSide ? layout.castleTop : layout.castleLeft),
          width: run.length,
          cells: run.map((cell) => ({ ...cell })),
          centerCol: run.reduce((sum, cell) => sum + cell.col, 0) / run.length,
          centerRow: run.reduce((sum, cell) => sum + cell.row, 0) / run.length,
          inwardDirection,
        });
        run = [];
      };

      for (const cell of cells) {
        const outsideCol = cell.col + outsideColOffset;
        const outsideRow = cell.row + outsideRowOffset;
        const outsideTile = this.#inBounds(outsideCol, outsideRow) ? grid[outsideRow][outsideCol] : TileType.WATER;
        if (grid[cell.row][cell.col] === TileType.PATH && (outsideTile === TileType.PATH || outsideTile === TileType.ENTRY)) {
          run.push(cell);
        } else {
          flushRun();
        }
      }
      flushRun();
    };

    collectGate(
      'WEST',
      Array.from({ length: layout.castleBottom - layout.castleTop + 1 }, (_, index) => ({
        col: layout.castleLeft,
        row: layout.castleTop + index,
      })),
      this.#DIRECTIONS.EAST,
      -1,
      0,
    );
    collectGate(
      'EAST',
      Array.from({ length: layout.castleBottom - layout.castleTop + 1 }, (_, index) => ({
        col: layout.castleRight,
        row: layout.castleTop + index,
      })),
      this.#DIRECTIONS.WEST,
      1,
      0,
    );
    collectGate(
      'NORTH',
      Array.from({ length: layout.castleRight - layout.castleLeft + 1 }, (_, index) => ({
        col: layout.castleLeft + index,
        row: layout.castleTop,
      })),
      this.#DIRECTIONS.SOUTH,
      0,
      -1,
    );
    collectGate(
      'SOUTH',
      Array.from({ length: layout.castleRight - layout.castleLeft + 1 }, (_, index) => ({
        col: layout.castleLeft + index,
        row: layout.castleBottom,
      })),
      this.#DIRECTIONS.NORTH,
      0,
      1,
    );

    return {
      position: {
        col: layout.castleLeft,
        row: layout.castleTop,
        width: layout.castleRight - layout.castleLeft + 1,
        depth: layout.castleBottom - layout.castleTop + 1,
        elevation: this.#FOUNDATION_HEIGHT,
      },
      style: layout.castleFootprint.style,
      doors,
      occupant:
        this.#CASTLE_OCCUPANTS[
          this.#rng(0, this.#CASTLE_OCCUPANTS.length - 1)
        ],
    };
  }

  static #insideEllipse(col, row, centerCol, centerRow, radiusX, radiusY) {
    const dx = (col - centerCol) / radiusX;
    const dy = (row - centerRow) / radiusY;
    return dx * dx + dy * dy <= 1;
  }

  static #fillHeightRect(grid, heightmap, left, top, right, bottom, value, predicate = () => true) {
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        if (!this.#inBounds(col, row)) continue;
        if (heightmap[row][col] === this.#WATER_HEIGHT) continue;
        if (!predicate(grid[row][col], col, row)) continue;
        heightmap[row][col] = value;
      }
    }
  }

  static #blendGrassNearPaths(grid, heightmap) {
    for (let row = 1; row < this.#MAP_ROWS - 1; row++) {
      for (let col = 1; col < this.#MAP_COLS - 1; col++) {
        if (grid[row][col] !== TileType.GRASS) continue;

        let touchesPath = false;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const tile = grid[row + dr][col + dc];
          if (tile === TileType.PATH || tile === TileType.ENTRY) {
            touchesPath = true;
            break;
          }
        }

        if (touchesPath) {
          heightmap[row][col] = this.#PATH_HEIGHT;
        }
      }
    }
  }

  static #flattenBuildableZones(grid, heightmap, layout) {
    const topPadRight = this.#clamp(layout.castleLeft - 10, 10, 15);
    this.#fillHeightRect(grid, heightmap, 6, 2, topPadRight, 8, 1, tile => tile === TileType.GRASS);
    this.#fillHeightRect(grid, heightmap, 6, 27, 12, 33, 1, tile => tile === TileType.GRASS);
    this.#fillHeightRect(grid, heightmap, 18, 23, 24, 29, 2, tile => tile === TileType.GRASS);
    this.#fillHeightRect(
      grid,
      heightmap,
      layout.castleLeft - 2,
      layout.castleTop - 1,
      layout.castleRight,
      layout.castleBottom + 1,
      this.#FOUNDATION_HEIGHT,
      tile => tile !== TileType.WATER && tile !== TileType.PATH && tile !== TileType.ENTRY
    );
    this.#fillHeightRect(
      grid,
      heightmap,
      10,
      layout.pathRows[0],
      layout.castleEntranceCol,
      layout.pathRows[1],
      this.#PATH_HEIGHT,
      tile => tile === TileType.PATH || tile === TileType.ENTRY
    );
  }

  static #buildHeightmap(grid, layout) {
    const heightmap = this.#createGrid(this.#WATER_HEIGHT);

    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        const tile = grid[row][col];
        if (tile === TileType.WATER) continue;
        if (tile === TileType.PATH || tile === TileType.ENTRY) {
          heightmap[row][col] = this.#PATH_HEIGHT;
          continue;
        }
        if (tile === TileType.CASTLE_WALL || tile === TileType.CASTLE_TOWER) {
          heightmap[row][col] = this.#FOUNDATION_HEIGHT;
          continue;
        }

        let height = 1;
        for (const hill of layout.hillEllipses) {
          if (this.#insideEllipse(col, row, hill.centerCol, hill.centerRow, hill.radiusX, hill.radiusY)) {
            height = Math.max(height, hill.height);
          }
        }
        heightmap[row][col] = height;
      }
    }

    this.#smoothGrassHeights(grid, heightmap);
    this.#blendGrassNearPaths(grid, heightmap);
    this.#flattenBuildableZones(grid, heightmap, layout);
    return heightmap;
  }

  static #smoothGrassHeights(grid, heightmap) {
    let changed = true;

    while (changed) {
      changed = false;
      for (let row = 1; row < this.#MAP_ROWS - 1; row++) {
        for (let col = 1; col < this.#MAP_COLS - 1; col++) {
          if (grid[row][col] !== TileType.GRASS) continue;
          if (heightmap[row][col] <= 1) continue;

          let similarNeighbors = 0;
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (grid[row + dr][col + dc] === TileType.GRASS && heightmap[row + dr][col + dc] === heightmap[row][col]) {
              similarNeighbors++;
            }
          }

          if (similarNeighbors === 0) {
            heightmap[row][col] -= 1;
            changed = true;
          }
        }
      }
    }
  }

  static #applyHeightsToMetadata(grid, tileMeta, heightmap) {
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        tileMeta[row][col] = {
          ...tileMeta[row][col],
          baseHeight: heightmap[row][col],
          renderMode: this.#classifyRenderMode(grid, tileMeta, col, row),
        };

        const tile = grid[row][col];
        if (tile === TileType.CASTLE_WALL || tile === TileType.CASTLE_TOWER) {
          tileMeta[row][col].surfaceType = 'STRUCTURE';
        } else if (tile === TileType.PATH) {
          tileMeta[row][col].surfaceType = 'PATH';
        } else if (tile === TileType.ENTRY) {
          tileMeta[row][col].surfaceType = 'STRUCTURE';
        } else if (tile === TileType.GRASS) {
          tileMeta[row][col].surfaceType = 'GRASS';
        }
      }
    }
  }

  static #classifyRenderMode(grid, tileMeta, col, row) {
    const tile = grid[row][col];
    if (tile !== TileType.PATH && tile !== TileType.ENTRY) {
      return 'SOLID';
    }

    const direction = tileMeta[row][col].direction;
    if (direction === this.#DIRECTIONS.EAST || direction === this.#DIRECTIONS.WEST) {
      const mateRow = this.#findLaneMateRow(grid, tileMeta, col, row, direction);
      if (mateRow === null) return 'SOLID';
      const topOuterRow = Math.min(row, mateRow) - 1;
      const bottomOuterRow = Math.max(row, mateRow) + 1;
      if (!this.#inBounds(col, topOuterRow) || !this.#inBounds(col, bottomOuterRow)) {
        return 'SOLID';
      }
      if (grid[topOuterRow][col] === TileType.WATER && grid[bottomOuterRow][col] === TileType.WATER) {
        return 'BRIDGE';
      }
      return 'SOLID';
    }

    if (direction === this.#DIRECTIONS.NORTH || direction === this.#DIRECTIONS.SOUTH) {
      const mateCol = this.#findLaneMateCol(grid, tileMeta, col, row, direction);
      if (mateCol === null) return 'SOLID';
      const leftOuterCol = Math.min(col, mateCol) - 1;
      const rightOuterCol = Math.max(col, mateCol) + 1;
      if (!this.#inBounds(leftOuterCol, row) || !this.#inBounds(rightOuterCol, row)) {
        return 'SOLID';
      }
      if (grid[row][leftOuterCol] === TileType.WATER && grid[row][rightOuterCol] === TileType.WATER) {
        return 'BRIDGE';
      }
    }

    return 'SOLID';
  }

  static #findLaneMateRow(grid, tileMeta, col, row, direction) {
    const candidates = [row - 1, row + 1];
    for (const candidateRow of candidates) {
      if (!this.#inBounds(col, candidateRow)) continue;
      const candidateTile = grid[candidateRow][col];
      if (candidateTile !== TileType.PATH && candidateTile !== TileType.ENTRY) continue;
      if (tileMeta[candidateRow][col].direction === direction) {
        return candidateRow;
      }
    }
    return null;
  }

  static #findLaneMateCol(grid, tileMeta, col, row, direction) {
    const candidates = [col - 1, col + 1];
    for (const candidateCol of candidates) {
      if (!this.#inBounds(candidateCol, row)) continue;
      const candidateTile = grid[row][candidateCol];
      if (candidateTile !== TileType.PATH && candidateTile !== TileType.ENTRY) continue;
      if (tileMeta[row][candidateCol].direction === direction) {
        return candidateCol;
      }
    }
    return null;
  }

  static #routeNodeKey(col2, row2) {
    return `${col2},${row2}`;
  }

  static #appendRouteWaypoint(waypoints, col2, row2) {
    const previous = waypoints[waypoints.length - 1];
    if (previous?.col2 === col2 && previous?.row2 === row2) return;
    waypoints.push({ col2, row2 });
  }

  static #buildRouteWaypoints(layout, entry) {
    const waypoints = [];
    const gateCenterRow2 = entry.gateRows[0] + entry.gateRows[1];
    const trunkCenterRow2 = layout.pathRows[0] + layout.pathRows[1];
    const mergeCenterCol2 = entry.mergeCol * 2 + 1;

    this.#appendRouteWaypoint(waypoints, entry.gateCol * 2, gateCenterRow2);

    if (entry.curvePlan) {
      const { bands, turnCols } = entry.curvePlan;
      for (let index = 0; index < bands.length; index++) {
        const turnCenterCol2 = turnCols[index] * 2 + 1;
        const bandCenterRow2 = bands[index][0] + bands[index][1];
        this.#appendRouteWaypoint(
          waypoints,
          turnCenterCol2,
          waypoints[waypoints.length - 1].row2,
        );
        this.#appendRouteWaypoint(waypoints, turnCenterCol2, bandCenterRow2);
      }
    }

    this.#appendRouteWaypoint(
      waypoints,
      mergeCenterCol2,
      waypoints[waypoints.length - 1].row2,
    );
    this.#appendRouteWaypoint(waypoints, mergeCenterCol2, trunkCenterRow2);
    this.#appendRouteWaypoint(
      waypoints,
      layout.castleEntranceCol * 2,
      trunkCenterRow2,
    );

    return waypoints;
  }

  static #expandRouteWaypoints(waypoints) {
    const points = [{ ...waypoints[0] }];

    for (let index = 1; index < waypoints.length; index++) {
      const destination = waypoints[index];
      const current = points[points.length - 1];
      if (![current.col2, current.row2, destination.col2, destination.row2].every(Number.isInteger)) {
        throw new InvalidRouteWaypointError();
      }
      const deltaCol = destination.col2 - current.col2;
      const deltaRow = destination.row2 - current.row2;
      if (deltaCol !== 0 && deltaRow !== 0) {
        throw new NonOrthogonalRouteSegmentError();
      }

      const stepCol = Math.sign(deltaCol);
      const stepRow = Math.sign(deltaRow);
      let col2 = current.col2;
      let row2 = current.row2;
      while (col2 !== destination.col2 || row2 !== destination.row2) {
        col2 += stepCol;
        row2 += stepRow;
        points.push({ col2, row2 });
      }
    }

    return points;
  }

  static #connectRouteNodes(graph, first, second) {
    const firstKey = this.#routeNodeKey(first.col2, first.row2);
    const secondKey = this.#routeNodeKey(second.col2, second.row2);
    if (!graph.has(firstKey)) graph.set(firstKey, new Set());
    if (!graph.has(secondKey)) graph.set(secondKey, new Set());
    graph.get(firstKey).add(secondKey);
    graph.get(secondKey).add(firstKey);
  }

  static #buildRouteDistances(graph, targetKey) {
    const distances = new Map([[targetKey, 0]]);
    const queue = [targetKey];
    let queueIndex = 0;

    while (queueIndex < queue.length) {
      const key = queue[queueIndex++];
      const distance = distances.get(key);
      for (const neighbor of graph.get(key) ?? []) {
        if (distances.has(neighbor)) continue;
        distances.set(neighbor, distance + 1);
        queue.push(neighbor);
      }
    }

    return distances;
  }

  static #followQuickestRoute(graph, distances, startKey, targetKey) {
    const route = [];
    let key = startKey;

    while (true) {
      const [col2, row2] = key.split(',').map(Number);
      route.push({ col: col2 / 2, row: row2 / 2 });
      if (key === targetKey) return route;

      const distance = distances.get(key);
      const nextKey = [...(graph.get(key) ?? [])]
        .filter(neighbor => distances.get(neighbor) === distance - 1)
        .sort()[0];

      if (!nextKey) {
        throw new GateRouteMissingError();
      }
      key = nextKey;
    }
  }

  static #buildArrowData(routes) {
    const arrowData = new Map();

    routes.forEach((route, pathIdx) => {
      const turnIndices = new Set();
      for (let index = 1; index < route.length - 1; index++) {
        const previous = route[index - 1];
        const current = route[index];
        const next = route[index + 1];
        const incomingDc = current.col - previous.col;
        const incomingDr = current.row - previous.row;
        const outgoingDc = next.col - current.col;
        const outgoingDr = next.row - current.row;
        if (incomingDc !== outgoingDc || incomingDr !== outgoingDr) {
          turnIndices.add(index);
        }
      }

      for (let index = 2; index < route.length - 1; index++) {
        const current = route[index];
        const next = route[index + 1];
        const previous = route[index - 1];
        let dc = next.col - current.col;
        let dr = next.row - current.row;
        const previousDc = current.col - previous.col;
        const previousDr = current.row - previous.row;
        const startsTurn = turnIndices.has(index);
        if (startsTurn) {
          dc += previousDc;
          dr += previousDr;
        } else if (
          [...turnIndices].some(turnIndex => Math.abs(turnIndex - index) <= 2)
        ) {
          continue;
        }
        const col2 = Math.round(current.col * 2);
        const row2 = Math.round(current.row * 2);
        if (Math.abs(col2) % 2 !== 1 || Math.abs(row2) % 2 !== 1) continue;

        const axis2 = dc === 0 ? row2 : col2;
        if (!startsTurn && Math.abs(axis2) % 4 !== 1) continue;

        const key = `${col2 / 2},${row2 / 2}`;
        const arrows = arrowData.get(key) ?? [];
        arrows.push({ dc, dr, marker: startsTurn ? 'turn' : 'arrow', pathIdx });
        arrowData.set(key, arrows);
      }
    });

    return arrowData;
  }

  static #buildRouteData(layout) {
    const graph = new Map();
    const rawRoutes = layout.entries.map(entry => {
      const route = this.#expandRouteWaypoints(this.#buildRouteWaypoints(layout, entry));
      for (let index = 1; index < route.length; index++) {
        this.#connectRouteNodes(graph, route[index - 1], route[index]);
      }
      return route;
    });
    const targetKey = this.#routeNodeKey(
      layout.castleEntranceCol * 2,
      layout.pathRows[0] + layout.pathRows[1],
    );
    const distances = this.#buildRouteDistances(graph, targetKey);
    const routes = rawRoutes.map(route =>
      this.#followQuickestRoute(
        graph,
        distances,
        this.#routeNodeKey(route[0].col2, route[0].row2),
        targetKey,
      )
    );

    return { routes, arrowData: this.#buildArrowData(routes) };
  }

  static #findConnectedComponent(grid, startTiles) {
    const seen = new Set();
    const queue = [...startTiles];

    while (queue.length) {
      const { col, row } = queue.shift();
      const key = this.#tileKey(col, row);
      if (seen.has(key)) continue;
      if (!this.#inBounds(col, row)) continue;
      if (grid[row][col] === TileType.WATER) continue;

      seen.add(key);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        queue.push({ col: col + dc, row: row + dr });
      }
    }

    return seen;
  }

  static #isVegetationCandidate(
    grid,
    heightmap,
    tileMeta,
    layout,
    col,
    row,
  ) {
    if (!this.#inBounds(col, row)) return false;
    if (grid[row][col] !== TileType.GRASS) return false;
    if (tileMeta[row][col].shape !== this.#TILE_SHAPE.FLAT) return false;
    if (!Number.isFinite(heightmap[row][col])) return false;

    if (
      col >= layout.castleLeft - 2 &&
      col <= layout.castleRight + 2 &&
      row >= layout.castleTop - 2 &&
      row <= layout.castleBottom + 2
    ) {
      return false;
    }

    for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
      for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
        const neighborCol = col + deltaCol;
        const neighborRow = row + deltaRow;
        if (!this.#inBounds(neighborCol, neighborRow)) continue;
        if (this.#isRouteTile(grid[neighborRow][neighborCol])) return false;
      }
    }
    return true;
  }

  static #placeVegetation(grid, heightmap, tileMeta, layout) {
    const candidates = [];
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        if (
          this.#isVegetationCandidate(
            grid,
            heightmap,
            tileMeta,
            layout,
            col,
            row,
          )
        ) {
          candidates.push({ col, row });
        }
      }
    }

    if (!candidates.length) return [];

    const sparseTargetCount = this.#clamp(
      Math.round(candidates.length / 35),
      12,
      24,
    );
    const targetCount = Math.min(candidates.length, sparseTargetCount * 9);
    const centerCount = this.#clamp(Math.round(targetCount / 6), 18, 36);
    const centerCandidates = this.#shuffle([...candidates]);
    const centers = [];
    for (const candidate of centerCandidates) {
      if (
        centers.some(
          center =>
            Math.max(
              Math.abs(center.col - candidate.col),
              Math.abs(center.row - candidate.row),
            ) < 3,
        )
      ) {
        continue;
      }
      centers.push(candidate);
      if (centers.length === centerCount) break;
    }

    const selected = [];
    const occupied = new Set();
    const addCandidate = candidate => {
      const key = this.#tileKey(candidate.col, candidate.row);
      if (occupied.has(key) || selected.length >= targetCount) return;
      occupied.add(key);
      selected.push(candidate);
    };

    for (const center of centers) {
      const nearby = this.#shuffle(
        candidates.filter(
          candidate =>
            Math.max(
              Math.abs(center.col - candidate.col),
              Math.abs(center.row - candidate.row),
            ) <= 2,
        ),
      );
      const clusterSize = this.#rng(5, 9);
      for (const candidate of nearby.slice(0, clusterSize)) {
        addCandidate(candidate);
      }
    }

    for (const candidate of this.#shuffle([...candidates])) {
      addCandidate(candidate);
    }

    const treeVariants = this.#shuffle([...this.#TREE_VARIANTS]);
    const bushVariants = this.#shuffle([...this.#BUSH_VARIANTS]);
    const treeCount = Math.round(selected.length * 0.8);
    const kinds = this.#shuffle(
      selected.map((_, index) => (index < treeCount ? 'tree' : 'bush')),
    );
    let treeIndex = 0;
    let bushIndex = 0;
    return selected.map((candidate, index) => {
      const kind = kinds[index];
      const variant =
        kind === 'tree'
          ? treeVariants[treeIndex++ % treeVariants.length]
          : bushVariants[bushIndex++ % bushVariants.length];
      return {
        ...candidate,
        variant,
        kind,
        rotation: this.#rng(0, 3) * 90,
      };
    });
  }

  static #isGroundCoverCandidate(
    grid,
    heightmap,
    tileMeta,
    col,
    row,
  ) {
    if (!this.#inBounds(col, row)) return false;
    if (grid[row][col] !== TileType.GRASS) return false;
    if (tileMeta[row][col].shape !== this.#TILE_SHAPE.FLAT) return false;
    if (!Number.isFinite(heightmap[row][col])) return false;
    return true;
  }

  static #placeGroundCover(
    grid,
    heightmap,
    tileMeta,
    vegetationData,
  ) {
    const occupied = new Set(
      vegetationData.map(({ col, row }) => this.#tileKey(col, row)),
    );
    const candidates = [];
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        if (this.#isGroundCoverCandidate(grid, heightmap, tileMeta, col, row)) {
          candidates.push({ col, row });
        }
      }
    }

    const groundCover = [];
    for (const candidate of candidates) {
      const decorationTile = this.#tileKey(candidate.col, candidate.row);
      if (!occupied.has(decorationTile) && this.#rng(0, 99) < 22) {
        groundCover.push(
          this.#createGroundCoverDecoration(
            candidate,
            this.#randomItem(this.#FLOWER_PATCH_VARIANTS),
            this.#rng(-13, 13) / 100,
            this.#rng(-13, 13) / 100,
          ),
        );
      } else if (!occupied.has(decorationTile) && this.#rng(0, 99) < 4) {
        groundCover.push(
          this.#createGroundCoverDecoration(
            candidate,
            this.#randomItem(this.#MUSHROOM_PATCH_VARIANTS),
            this.#rng(-15, 15) / 100,
            this.#rng(-15, 15) / 100,
          ),
        );
      }
    }
    return groundCover;
  }

  static #createGroundCoverDecoration(
    candidate,
    variant,
    offsetX,
    offsetZ,
  ) {
    return {
      ...candidate,
      variant,
      offsetX,
      offsetZ,
      rotation: this.#rng(0, 23) * 15,
      scale: this.#rng(88, 112) / 100,
      phase: this.#rng(0, 628) / 100,
    };
  }

  static #validateIslandConnectivity(grid) {
    const allLand = [];
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        if (grid[row][col] !== TileType.WATER) {
          allLand.push({ col, row });
        }
      }
    }

    if (!allLand.length) {
      throw new NoPlayableTerrainError();
    }

    const seen = this.#findConnectedComponent(grid, [allLand[0]]);
    if (seen.size !== allLand.length) {
      throw new DisconnectedTerrainError();
    }
  }

  static #validateGatePlacement(grid, layout) {
    for (const entry of layout.entries) {
      const outsideCol = entry.inwardDirection === this.#DIRECTIONS.WEST ? entry.gateCol + 1 : entry.gateCol - 1;
      const insideCol = entry.inwardDirection === this.#DIRECTIONS.WEST ? entry.gateCol - 1 : entry.gateCol + 1;

      for (const row of entry.gateRows) {
        if (grid[row][entry.gateCol] !== TileType.ENTRY) {
          throw new InvalidGatePositionError();
        }
        if (this.#inBounds(outsideCol, row) && grid[row][outsideCol] !== TileType.WATER) {
          throw new PathOutsideGateError();
        }
        if (!this.#inBounds(insideCol, row) || grid[row][insideCol] !== TileType.PATH) {
          throw new GatePathMissingError();
        }
      }
    }
  }

  static #validatePathSpacing(layout) {
    for (let i = 0; i < layout.entries.length; i++) {
      for (let j = i + 1; j < layout.entries.length; j++) {
        const aBottom = layout.entries[i].gateRows[1];
        const bTop = layout.entries[j].gateRows[0];
        if (bTop - aBottom < 3) {
          throw new InsufficientEntryPathSpacingError();
        }
      }
    }
  }

  static #isRouteTile(tile) {
    return tile === TileType.PATH || tile === TileType.ENTRY;
  }

  static #isWithinMergeZone(layout, col, row) {
    const mergeCol = layout.entries[0]?.mergeCol;
    if (!Number.isFinite(mergeCol)) return false;
    return col >= mergeCol && col <= mergeCol + 1 && row >= layout.pathRows[0] && row <= layout.pathRows[1];
  }

  static #validateParallelPathClearance(grid, layout) {
    for (let col = 0; col < this.#MAP_COLS; col++) {
      const horizontalBands = [];
      for (let row = 0; row < this.#MAP_ROWS - 1; row++) {
        if (!this.#isRouteTile(grid[row][col]) || !this.#isRouteTile(grid[row + 1][col])) continue;
        if (row > 0 && this.#isRouteTile(grid[row - 1][col])) continue;
        horizontalBands.push(row);
      }

      for (let i = 0; i < horizontalBands.length; i++) {
        for (let j = i + 1; j < horizontalBands.length; j++) {
          const topStart = horizontalBands[i];
          const bottomStart = horizontalBands[j];
          if (bottomStart - topStart >= 4) continue;
          const topInMerge = this.#isWithinMergeZone(layout, col, topStart) || this.#isWithinMergeZone(layout, col, topStart + 1);
          const bottomInMerge = this.#isWithinMergeZone(layout, col, bottomStart) || this.#isWithinMergeZone(layout, col, bottomStart + 1);
          if (topInMerge && bottomInMerge) continue;
          throw new InsufficientParallelPathSpacingError();
        }
      }
    }

    for (let row = 0; row < this.#MAP_ROWS; row++) {
      const verticalBands = [];
      for (let col = 0; col < this.#MAP_COLS - 1; col++) {
        if (!this.#isRouteTile(grid[row][col]) || !this.#isRouteTile(grid[row][col + 1])) continue;
        if (col > 0 && this.#isRouteTile(grid[row][col - 1])) continue;
        verticalBands.push(col);
      }

      for (let i = 0; i < verticalBands.length; i++) {
        for (let j = i + 1; j < verticalBands.length; j++) {
          const leftStart = verticalBands[i];
          const rightStart = verticalBands[j];
          if (rightStart - leftStart >= 4) continue;
          const leftInMerge = this.#isWithinMergeZone(layout, leftStart, row) || this.#isWithinMergeZone(layout, leftStart + 1, row);
          const rightInMerge = this.#isWithinMergeZone(layout, rightStart, row) || this.#isWithinMergeZone(layout, rightStart + 1, row);
          if (leftInMerge && rightInMerge) continue;
          throw new InsufficientParallelPathSpacingError();
        }
      }
    }
  }

  static #validateRouteReachability(grid, layout) {
    const entranceTargets = layout.castleEntranceRows.map(row => this.#tileKey(layout.castleEntranceCol, row));

    for (const entry of layout.entries) {
      const seen = new Set();
      const queue = entry.gateRows.map(row => ({ col: entry.gateCol, row }));

      while (queue.length) {
        const current = queue.shift();
        const key = this.#tileKey(current.col, current.row);
        if (seen.has(key)) continue;
        if (!this.#inBounds(current.col, current.row)) continue;
        const tile = grid[current.row][current.col];
        if (tile !== TileType.PATH && tile !== TileType.ENTRY) continue;
        seen.add(key);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          queue.push({ col: current.col + dc, row: current.row + dr });
        }
      }

      if (!entranceTargets.some(key => seen.has(key))) {
        throw new EntryPathUnreachableError();
      }
    }
  }

  static #validateCastleEntrance(grid, layout) {
    const entranceRows = [...layout.castleEntranceRows].sort((left, right) => left - right);
    if (entranceRows.length !== 2 || entranceRows[1] !== entranceRows[0] + 1) {
      throw new InvalidCastleEntranceWidthError();
    }

    for (const row of entranceRows) {
      if (grid[row][layout.castleEntranceCol] !== TileType.PATH) {
        throw new CastleEntrancePathMissingError();
      }
    }
  }

  static #validateCastleGroundClearance(grid, layout) {
    for (
      let row = layout.castleTop - this.#CASTLE_GROUND_CLEARANCE;
      row <= layout.castleBottom + this.#CASTLE_GROUND_CLEARANCE;
      row++
    ) {
      for (
        let col = layout.castleLeft - this.#CASTLE_GROUND_CLEARANCE;
        col <= layout.castleRight + this.#CASTLE_REAR_GROUND_CLEARANCE;
        col++
      ) {
        if (!this.#inBounds(col, row) || grid[row][col] === TileType.WATER) {
          throw new InsufficientCastleClearanceError();
        }
      }
    }
  }

  static #validateHeightDiscipline(grid, heightmap) {
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        const tile = grid[row][col];
        if ((tile === TileType.PATH || tile === TileType.ENTRY) && heightmap[row][col] !== this.#PATH_HEIGHT) {
          throw new PathHeightMismatchError();
        }
      }
    }
  }

  static #validateGrassNoise(grid, heightmap) {
    for (let row = 1; row < this.#MAP_ROWS - 1; row++) {
      for (let col = 1; col < this.#MAP_COLS - 1; col++) {
        if (grid[row][col] !== TileType.GRASS) continue;
        if (heightmap[row][col] <= 1) continue;

        let relatedNeighbors = 0;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (grid[row + dr][col + dc] !== TileType.GRASS) continue;
          if (heightmap[row + dr][col + dc] >= heightmap[row][col] - 1) {
            relatedNeighbors++;
          }
        }

        if (relatedNeighbors === 0) {
          throw new IsolatedGrassElevationError();
        }
      }
    }
  }

  static #validateLayoutVariety(layout) {
    if (layout.islandEllipses.every((ellipse, index) => {
      const base = [
        { centerCol: 23, centerRow: 16, radiusX: 18, radiusY: 12 },
        { centerCol: 15, centerRow: 15, radiusX: 12, radiusY: 10 },
        { centerCol: 14, centerRow: 27, radiusX: 10, radiusY: 7 },
        { centerCol: 29, centerRow: 13, radiusX: 10, radiusY: 8 },
      ][index];
      return base &&
        ellipse.centerCol === base.centerCol &&
        ellipse.centerRow === base.centerRow &&
        ellipse.radiusX === base.radiusX &&
        ellipse.radiusY === base.radiusY;
    })) {
      throw new InsufficientLayoutVarietyError();
    }
  }

  static #validateVegetation(
    grid,
    heightmap,
    tileMeta,
    layout,
    vegetationData,
  ) {
    const occupied = new Set();
    const variants = new Set();
    for (const vegetation of vegetationData) {
      const { col, row, variant } = vegetation;
      const key = this.#tileKey(col, row);
      if (occupied.has(key)) {
        throw new InvalidVegetationPlacementError({
          col,
          row,
          reason: 'duplicates another vegetation placement',
        });
      }
      if (
        !this.#isVegetationCandidate(
          grid,
          heightmap,
          tileMeta,
          layout,
          col,
          row,
        )
      ) {
        throw new InvalidVegetationPlacementError({
          col,
          row,
          reason: 'is not on valid, path-cleared flat grass',
        });
      }
      if (!this.#VEGETATION_VARIANTS.includes(variant)) {
        throw new InvalidVegetationPlacementError({
          col,
          row,
          reason: `uses unknown variation ${variant}`,
        });
      }
      occupied.add(key);
      variants.add(variant);
    }

    const expectedVariety = Math.min(5, vegetationData.length);
    if (variants.size < expectedVariety) {
      throw new InsufficientVegetationVarietyError({
        expected: expectedVariety,
        actual: variants.size,
      });
    }
  }

  static #validateGroundCover(
    grid,
    heightmap,
    tileMeta,
    vegetationData,
    groundCoverData,
  ) {
    const vegetationTiles = new Set(
      vegetationData.map(({ col, row }) => this.#tileKey(col, row)),
    );
    for (const decoration of groundCoverData) {
      const { col, row, variant } = decoration;
      const key = this.#tileKey(col, row);
      if (vegetationTiles.has(key)) {
        throw new InvalidGroundCoverPlacementError({
          col,
          row,
          reason: 'overlaps a tree or bush',
        });
      }
      if (
        !this.#isGroundCoverCandidate(
          grid,
          heightmap,
          tileMeta,
          col,
          row,
        )
      ) {
        throw new InvalidGroundCoverPlacementError({
          col,
          row,
          reason: 'is not on valid flat grass',
        });
      }
      if (!this.#GROUND_COVER_VARIANTS.includes(variant)) {
        throw new InvalidGroundCoverPlacementError({
          col,
          row,
          reason: `uses unknown variation ${variant}`,
        });
      }
    }
  }

  static #validateMap(
    grid,
    heightmap,
    tileMeta,
    layout,
    vegetationData,
    groundCoverData,
  ) {
    this.#validateIslandConnectivity(grid);
    this.#validateGatePlacement(grid, layout);
    this.#validatePathSpacing(layout);
    this.#validateParallelPathClearance(grid, layout);
    this.#validateRouteReachability(grid, layout);
    this.#validateCastleEntrance(grid, layout);
    this.#validateCastleGroundClearance(grid, layout);
    this.#validateHeightDiscipline(grid, heightmap);
    this.#validateGrassNoise(grid, heightmap);
    this.#validateLayoutVariety(layout);
    this.#validateVegetation(
      grid,
      heightmap,
      tileMeta,
      layout,
      vegetationData,
    );
    this.#validateGroundCover(
      grid,
      heightmap,
      tileMeta,
      vegetationData,
      groundCoverData,
    );
  }
}

export function generateMap(options) {
  return MapGenerator.generate(options);
}
