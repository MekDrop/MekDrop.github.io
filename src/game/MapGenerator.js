import {
  BridgeGroundHeightMismatchError,
  BridgeTurnError,
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
  InvalidLavaRiverCountError,
  InvalidOverpassError,
  InvalidPathDipError,
  InvalidRiverCountError,
  InvalidRiverFlowError,
  InvalidRiverPathError,
  InvalidRouteWaypointError,
  InvalidVegetationPlacementError,
  IsolatedGrassElevationError,
  IsolatedTerrainHoleError,
  NoPlayableTerrainError,
  NonOrthogonalRouteSegmentError,
  PathHeightMismatchError,
  PathOutsideGateError,
  PathRenderModeMismatchError,
  UnexpectedPathConnectionError,
  UnexpectedPathCrossingError,
} from './errors/map/index.js';
import { RIVER_KIND } from './enum/RiverKind.js';
import { isNumber } from './helpers/types.js';
import { SLOPE_DIRECTION } from './enum/SlopeDirection.js';
import { TILE_SHAPE } from './enum/TileShape.js';

export const TileType = {
  WATER: 0,
  GRASS: 1,
  PATH: 2,
  CASTLE_WALL: 3,
  CASTLE_TOWER: 4,
  ENTRY: 5,
};

export class MapGenerator {
  static #random = Math.random;
  static #MAP_COLS = 42;
  static #MAP_ROWS = 42;
  static #DEFAULT_MIN_PATHS = 2;
  static #DEFAULT_MAX_PATHS = 4;
  static #LEFT_GATE_COL = 4;
  static #RIGHT_GATE_COL = this.#MAP_COLS - 1 - this.#LEFT_GATE_COL;
  static #PATH_HEIGHT = 2;
  static #FOUNDATION_HEIGHT = 3;
  static #WATER_HEIGHT = 0;
  static #MAX_RIVERS = 6;
  static #MIN_RIVER_TILES = 7;
  static #RIVER_SURFACE_INSET = 0.5;
  static #LAVA_SURFACE_INSET = 0.22;
  static #RIVER_WATER_DEPTH = 0.5;
  static #BRIDGE_WATER_CLEARANCE = 0.52;
  static #RIVER_CASTLE_SETBACK = 6;
  static #TERMINAL_WATERFALL_BOTTOM = -10.5;
  static #RIVER_COUNT_WEIGHTS = [15, 35, 22, 13, 8, 5, 2];
  static #LAVA_ISLAND_CHANCE = 10;
  static #MAX_LAVA_ELIGIBLE_RIVERS = 2;
  static #CASTLE_GROUND_CLEARANCE = 3;
  static #CASTLE_REAR_GROUND_CLEARANCE = 1;
  static #OVERPASS_CHANCE_BY_PATH_COUNT = [0, 0, 10, 28, 46];
  static #OVERPASS_ELEVATION = this.#PATH_HEIGHT + 2;
  static #OVERPASS_RAMP_TILES = 4;
  static #OVERPASS_HALF_STEP = 0.5;
  static #OVERPASS_DECK_THICKNESS = 0.24;
  static #OVERPASS_MIN_CLEARANCE = 1.6;
  static #MIN_ARROW_GATE_CLEARANCE = 0.5;
  static #MIN_ARROW_CASTLE_CLEARANCE = 4;
  static #TERRAIN_BRIDGE_DIP_CHANCE = 60;
  static #TERRAIN_BRIDGE_DIP_ELEVATION = this.#PATH_HEIGHT - 1;
  static #TERRAIN_BRIDGE_DIP_RAMP_TILES = 2;
  static #TERRAIN_BRIDGE_DIP_MIN_SPAN =
    this.#TERRAIN_BRIDGE_DIP_RAMP_TILES * 2 + 1;
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
    const normalizedOptions = this.#normalizeOptions(options);
    const mapName = String(normalizedOptions.mapName ?? this.#createMapName());
    const previousRandom = this.#random;
    this.#random = this.#createSeededRandom(mapName);

    try {
      return {
        ...this.#generate({ ...normalizedOptions, mapName }),
        mapName,
      };
    } finally {
      this.#random = previousRandom;
    }
  }

  static #generate(options) {
    const {
      numPaths: requestedNumPaths,
      numRivers: requestedNumRivers,
      overpass: requestedOverpass,
      mapName,
    } = this.#normalizeOptions(options);
    const numPaths = this.#clamp(
      Number.isFinite(requestedNumPaths)
        ? Math.round(requestedNumPaths)
        : this.#rng(this.#DEFAULT_MIN_PATHS, this.#DEFAULT_MAX_PATHS),
      1,
      this.#ENTRY_TEMPLATES.length,
    );
    const layout = this.#createLayoutConfig(numPaths);
    layout.overpassPlan = this.#selectOverpassPlan(
      layout,
      requestedOverpass,
    );
    if (!layout.overpassPlan) {
      this.#retainSeparatedCurvePlans(layout);
    }
    layout.signature = mapName;
    const grid = this.#createGrid(TileType.WATER);
    const tileMeta = this.#createTileMetadata();
    const islandMask = this.#buildIslandMask(layout);

    this.#materializeIsland(grid, tileMeta, islandMask);
    const { mergeZones, routeCellsByPath, trunkStart } = this.#carvePaths(grid, tileMeta, layout);
    this.#materializeSingleCellTerrainHoles(grid, tileMeta, islandMask);
    if (
      layout.overpassPlan &&
      !this.#overpassPlanFits(layout.overpassPlan, islandMask, grid)
    ) {
      throw new InvalidOverpassError({ reason: 'does not fit its reserved terrain' });
    }
    this.#placeCastle(grid, tileMeta, layout);
    this.#materializeSingleCellTerrainHoles(grid, tileMeta, islandMask);

    const heightmap = this.#buildHeightmap(grid, layout);
    this.#applyOverpassTerrain(grid, heightmap, tileMeta, layout.overpassPlan);
    const riverData = this.#generateRivers(
      grid,
      heightmap,
      tileMeta,
      layout,
      islandMask,
      requestedNumRivers,
    );
    this.#assignRiverKinds(riverData);
    this.#raiseLavaSurfaces(heightmap, tileMeta, riverData);
    this.#smoothGrassHeights(grid, heightmap);
    this.#applyOverpassTerrain(grid, heightmap, tileMeta, layout.overpassPlan);
    this.#materializeRiverBanks(
      grid,
      heightmap,
      tileMeta,
      islandMask,
      riverData,
    );
    this.#materializePathSupports(grid, heightmap, tileMeta, riverData);
    layout.pathDipPlans = this.#applyTerrainBridgeDips(
      grid,
      heightmap,
      tileMeta,
      riverData,
      mergeZones,
    );
    this.#applyHeightsToMetadata(grid, tileMeta, heightmap, riverData);
    this.#materializeSingleCellTerrainHoles(
      grid,
      tileMeta,
      islandMask,
      heightmap,
    );
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
      islandMask,
      vegetationData,
      groundCoverData,
      riverData,
      routeCellsByPath,
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
      riverData,
      pipeData: new Map(),
      overpassData: layout.overpassPlan,
      pathDipData: layout.pathDipPlans,
      mergeZones,
      trunkStart,
      layoutSignature: layout.signature,
    };
  }

  static #rng(min, max) {
    return Math.floor(this.#random() * (max - min + 1)) + min;
  }

  static #createMapName() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.floor(Math.random() * 0x100000000)
      .toString(36)
      .padStart(7, "0");
    return `${timestamp}_${randomPart}`;
  }

  static #createSeededRandom(mapName) {
    let state = this.#hashMapName(mapName);

    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
    };
  }

  static #hashMapName(mapName) {
    let hash = 0x811c9dc5;
    for (const character of mapName) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
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
    if (isNumber(options)) {
      return { numPaths: options };
    }
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
        shape: TILE_SHAPE.FLAT,
        direction: this.#DIRECTIONS.NONE,
        renderMode: 'SOLID',
        bridgeGroundHeight: null,
      }))
    );
  }

  static #createLayoutConfig(numPaths) {
    const anchorRows = this.#ENTRY_TEMPLATES.map(template => [...template.gateRows]);
    const pathRows =
      numPaths > 1
        ? this.#randomItem([anchorRows[0], anchorRows[anchorRows.length - 1]])
        : anchorRows[this.#rng(0, anchorRows.length - 1)];
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
    };
  }

  static #inBounds(col, row) {
    return col >= 0 && col < this.#MAP_COLS && row >= 0 && row < this.#MAP_ROWS;
  }

  static #setTile(grid, tileMeta, col, row, type, overrides = {}) {
    if (!this.#inBounds(col, row)) {
      return;
    }
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
      const curveColumns = entry.curvePlan?.turnCols ?? [];
      const corridorLeft =
        Math.min(entry.gateCol, entry.mergeCol, ...curveColumns) - 1;
      const corridorRight =
        Math.max(
          entry.gateCol,
          entry.mergeCol + 1,
          ...curveColumns.map(col => col + 1),
        ) + 1;
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

    this.#fillSingleCellTerrainHoles(mask);
    return mask;
  }

  static #fillSingleCellTerrainHoles(mask) {
    const holes = [];
    for (let row = 1; row < this.#MAP_ROWS - 1; row++) {
      for (let col = 1; col < this.#MAP_COLS - 1; col++) {
        if (mask[row][col]) {
          continue;
        }
        const enclosed = [
          mask[row - 1][col],
          mask[row + 1][col],
          mask[row][col - 1],
          mask[row][col + 1],
        ].every(Boolean);
        if (enclosed) {
          holes.push({ col, row });
        }
      }
    }
    for (const { col, row } of holes) {
      mask[row][col] = true;
    }
  }

  static #materializeSingleCellTerrainHoles(
    grid,
    tileMeta,
    islandMask,
    heightmap = null,
  ) {
    const holes = [];
    for (let row = 1; row < this.#MAP_ROWS - 1; row++) {
      for (let col = 1; col < this.#MAP_COLS - 1; col++) {
        if (grid[row][col] !== TileType.WATER) {
          continue;
        }
        const enclosed = [
          grid[row - 1][col],
          grid[row + 1][col],
          grid[row][col - 1],
          grid[row][col + 1],
        ].every(tile => tile !== TileType.WATER);
        if (enclosed) {
          holes.push({ col, row });
        }
      }
    }
    for (const { col, row } of holes) {
      islandMask[row][col] = true;
      if (heightmap) {
        heightmap[row][col] = 1;
      }
      this.#setTile(grid, tileMeta, col, row, TileType.GRASS, {
        surfaceType: 'GRASS',
        baseHeight: 1,
      });
    }
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
    const shuffled = this.#shuffle([...this.#ENTRY_TEMPLATES]);
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

    if (!safeBands.length) {
      return null;
    }

    const bandStarts = this.#selectCurveBandStarts(safeBands);
    const turnCols = this.#pickCurveTurnCols(entry.side, entry.gateCol, mergeCol, bandStarts.length);
    if (!turnCols.length) {
      return null;
    }

    return {
      turnCols,
      bands: bandStarts.slice(0, turnCols.length).map(start => [start, start + 1]),
    };
  }

  static #selectOverpassPlan(layout, requestedOverpass) {
    if (requestedOverpass === false || layout.entries.length < 2) {
      return null;
    }

    const chance =
      this.#OVERPASS_CHANCE_BY_PATH_COUNT[layout.entries.length] ?? 0;
    if (requestedOverpass !== true && this.#rng(1, 100) > chance) {
      return null;
    }

    const trunkTop = layout.pathRows[0];
    const candidates = [];
    for (let upperPathIdx = 0; upperPathIdx < layout.entries.length; upperPathIdx++) {
      const upper = layout.entries[upperPathIdx];
      const upperOffset = upper.gateRows[0] - trunkTop;
      for (let lowerPathIdx = 0; lowerPathIdx < layout.entries.length; lowerPathIdx++) {
        const lower = layout.entries[lowerPathIdx];
        const lowerOffset = lower.gateRows[0] - trunkTop;
        if (
          upperPathIdx === lowerPathIdx ||
          upperOffset === 0 ||
          lowerOffset === 0 ||
          Math.sign(upperOffset) !== Math.sign(lowerOffset) ||
          Math.abs(upperOffset) < Math.abs(lowerOffset) + 5
        ) {
          continue;
        }

        const crossingCol =
          lower.side === 'LEFT'
            ? lower.mergeCol - 4
            : lower.mergeCol + 5;
        if (
          crossingCol <= Math.min(lower.gateCol, lower.mergeCol) + 2 ||
          crossingCol >= Math.max(lower.gateCol, lower.mergeCol) - 2
        ) {
          continue;
        }
        const towardTrunk = Math.sign(trunkTop - lower.gateRows[0]);
        const crossingClearanceRows = this.#OVERPASS_RAMP_TILES + 3;
        const landingTop =
          lower.gateRows[0] + towardTrunk * crossingClearanceRows;
        const upperApproachOffset =
          upper.gateRows[0] - lower.gateRows[0];
        const needsPreparation =
          Math.abs(upperApproachOffset) < crossingClearanceRows;
        const preparationTop =
          lower.gateRows[0] - towardTrunk * crossingClearanceRows;
        const preparationCol =
          upper.side === 'LEFT'
            ? Math.min(crossingCol - 4, upper.gateCol + 3)
            : Math.max(crossingCol + 4, upper.gateCol - 4);
        if (
          landingTop < 1 ||
          landingTop + 1 >= this.#MAP_ROWS - 1 ||
          (needsPreparation &&
            (preparationTop < 1 ||
              preparationTop + 1 >= this.#MAP_ROWS - 1))
        ) {
          continue;
        }
        const vertical = {
          pathIdx: upperPathIdx,
          start: {
            col2: crossingCol * 2 + 1,
            row2: upper.gateRows[0] + upper.gateRows[1],
          },
          end: {
            col2: crossingCol * 2 + 1,
            row2: landingTop * 2 + 1,
          },
        };
        const horizontal = {
          pathIdx: lowerPathIdx,
          start: {
            col2: lower.gateCol * 2,
            row2: lower.gateRows[0] + lower.gateRows[1],
          },
          end: {
            col2: lower.mergeCol * 2 + 1,
            row2: lower.gateRows[0] + lower.gateRows[1],
          },
        };
        candidates.push({
          upperPathIdx,
          lowerPathIdx,
          crossingCol,
          landingTop,
          preparationCol,
          preparationTop,
          needsPreparation,
          vertical,
          horizontal,
        });
      }
    }

    if (!candidates.length) {
      return null;
    }
    const originalCurvePlans = layout.entries.map((entry) => entry.curvePlan);
    const shuffledCandidates = this.#shuffle([...candidates]);
    for (const selected of shuffledCandidates) {
      for (const entry of layout.entries) {
        entry.curvePlan = null;
      }
      layout.entries[selected.upperPathIdx].curvePlan = selected.needsPreparation
        ? {
            turnCols: [selected.preparationCol, selected.crossingCol],
            bands: [
              [selected.preparationTop, selected.preparationTop + 1],
              [selected.landingTop, selected.landingTop + 1],
            ],
          }
        : {
            turnCols: [selected.crossingCol],
            bands: [[selected.landingTop, selected.landingTop + 1]],
          };
      const plan = this.#buildVerticalOverpassPlan(
        selected.vertical,
        selected.horizontal,
        selected.crossingCol * 2 + 1,
        layout.entries[selected.lowerPathIdx].gateRows[0] * 2 + 1,
      );
      const previewGrid = this.#createGrid(TileType.WATER);
      const { routeCellsByPath } = this.#carvePaths(
        previewGrid,
        this.#createTileMetadata(),
        layout,
      );
      if (
        !this.#findUnexpectedFlatPathCrossing(previewGrid, plan) &&
        !this.#findUnexpectedRouteConnection(
          routeCellsByPath,
          layout,
          plan,
        )
      ) {
        return plan;
      }
    }

    layout.entries.forEach((entry, index) => {
      entry.curvePlan = originalCurvePlans[index];
    });
    return null;
  }

  static #retainSeparatedCurvePlans(layout) {
    const curvePlans = layout.entries.map((entry) => entry.curvePlan);
    for (const entry of layout.entries) {
      entry.curvePlan = null;
    }

    for (let index = 0; index < layout.entries.length; index++) {
      const curvePlan = curvePlans[index];
      if (!curvePlan) {
        continue;
      }

      layout.entries[index].curvePlan = curvePlan;
      const previewGrid = this.#createGrid(TileType.WATER);
      const { routeCellsByPath } = this.#carvePaths(
        previewGrid,
        this.#createTileMetadata(),
        layout,
      );
      if (
        this.#findUnexpectedFlatPathCrossing(previewGrid, null) ||
        this.#hasInsufficientParallelPathClearance(previewGrid, layout) ||
        this.#findUnexpectedRouteConnection(
          routeCellsByPath,
          layout,
          null,
        )
      ) {
        layout.entries[index].curvePlan = null;
      }
    }
  }

  static #buildVerticalOverpassPlan(
    vertical,
    horizontal,
    crossingCol2,
    crossingRow2,
  ) {
    const col = (crossingCol2 - 1) / 2;
    const row = (crossingRow2 - 1) / 2;
    const crossingCells = [];
    const approachCells = [];
    const slopeCells = [];

    for (let lane = 0; lane < 2; lane++) {
      crossingCells.push({ col: col + lane, row });
      crossingCells.push({ col: col + lane, row: row + 1 });
      approachCells.push({ col: col + lane, row: row - 1 });
      approachCells.push({ col: col + lane, row: row + 2 });
      for (let step = 0; step < this.#OVERPASS_RAMP_TILES; step++) {
        slopeCells.push({
          col: col + lane,
          row: row - this.#OVERPASS_RAMP_TILES - 1 + step,
          lowHeight: this.#PATH_HEIGHT + step * this.#OVERPASS_HALF_STEP,
          highHeight:
            this.#PATH_HEIGHT + (step + 1) * this.#OVERPASS_HALF_STEP,
          riseDirection: SLOPE_DIRECTION.SOUTH,
        });
        slopeCells.push({
          col: col + lane,
          row: row + 3 + step,
          lowHeight:
            this.#PATH_HEIGHT +
            (this.#OVERPASS_RAMP_TILES - step - 1) *
              this.#OVERPASS_HALF_STEP,
          highHeight:
            this.#PATH_HEIGHT +
            (this.#OVERPASS_RAMP_TILES - step) *
              this.#OVERPASS_HALF_STEP,
          riseDirection: SLOPE_DIRECTION.NORTH,
        });
      }

    }
    return {
      id: 'path-overpass-0',
      upperPathIdx: vertical.pathIdx,
      lowerPathIdx: horizontal.pathIdx,
      upperDirection:
        vertical.end.row2 > vertical.start.row2
          ? this.#DIRECTIONS.SOUTH
          : this.#DIRECTIONS.NORTH,
      lowerDirection:
        horizontal.end.col2 > horizontal.start.col2
          ? this.#DIRECTIONS.EAST
          : this.#DIRECTIONS.WEST,
      baseElevation: this.#PATH_HEIGHT,
      deckElevation: this.#OVERPASS_ELEVATION,
      deckThickness: this.#OVERPASS_DECK_THICKNESS,
      clearance:
        this.#OVERPASS_ELEVATION -
        this.#OVERPASS_DECK_THICKNESS -
        this.#PATH_HEIGHT,
      crossing: { col, row, width: 2, depth: 2 },
      crossingCells,
      approachCells,
      slopeCells,
    };
  }

  static #overpassPlanFits(plan, islandMask, grid) {
    const pathCells = [
      ...plan.crossingCells,
      ...plan.approachCells,
      ...plan.slopeCells,
    ];
    for (const { col, row } of pathCells) {
      if (
        !this.#inBounds(col, row) ||
        !islandMask[row][col] ||
        grid[row][col] !== TileType.PATH
      ) {
        return false;
      }
    }
    return true;
  }

  static #collectSafeCurveBandStarts(min, max, occupiedBandStarts, trunkTop, direction) {
    if (min > max) {
      return [];
    }

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
          const startCol =
            entry.inwardDirection === this.#DIRECTIONS.EAST
              ? turnCols[index]
              : turnCols[index] + 1;
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
      if (!cells.length) {
        return;
      }

      let run = [];
      const flushRun = () => {
        if (!run.length) {
          return;
        }
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
      occupantSeed: this.#rng(0, 0xffffffff),
    };
  }

  static #selectRiverCount(requestedNumRivers) {
    if (Number.isFinite(requestedNumRivers)) {
      return this.#clamp(
        Math.round(requestedNumRivers),
        0,
        this.#MAX_RIVERS,
      );
    }

    const roll = this.#rng(1, 100);
    let cumulativeWeight = 0;
    for (
      let count = 0;
      count < this.#RIVER_COUNT_WEIGHTS.length;
      count++
    ) {
      cumulativeWeight += this.#RIVER_COUNT_WEIGHTS[count];
      if (roll <= cumulativeWeight) {
        return count;
      }
    }
    return this.#MAX_RIVERS;
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

  static #applyOverpassTerrain(grid, heightmap, tileMeta, plan) {
    if (!plan) {
      return;
    }

    for (const cell of plan.crossingCells) {
      heightmap[cell.row][cell.col] = plan.baseElevation;
      tileMeta[cell.row][cell.col] = {
        ...tileMeta[cell.row][cell.col],
        baseHeight: plan.baseElevation,
        direction: plan.lowerDirection,
        overpassId: plan.id,
        overpass: {
          direction: plan.upperDirection,
          elevation: plan.deckElevation,
        },
      };
    }

    for (const cell of plan.approachCells) {
      heightmap[cell.row][cell.col] = plan.deckElevation;
      tileMeta[cell.row][cell.col] = {
        ...tileMeta[cell.row][cell.col],
        baseHeight: plan.deckElevation,
        shape: TILE_SHAPE.FLAT,
        direction: plan.upperDirection,
        overpassId: plan.id,
      };
    }

    for (const cell of plan.slopeCells) {
      const centerHeight = (cell.lowHeight + cell.highHeight) / 2;
      heightmap[cell.row][cell.col] = centerHeight;
      tileMeta[cell.row][cell.col] = {
        ...tileMeta[cell.row][cell.col],
        baseHeight: centerHeight,
        shape: TILE_SHAPE.SLOPE,
        direction: plan.upperDirection,
        slope: {
          lowHeight: cell.lowHeight,
          highHeight: cell.highHeight,
          riseDirection: cell.riseDirection,
        },
        overpassId: plan.id,
      };
    }

    if (plan.clearance < this.#OVERPASS_MIN_CLEARANCE) {
      throw new InvalidOverpassError({
        reason: `provides only ${plan.clearance} blocks of underside clearance`,
      });
    }
  }

  static #hasRiverSourceSetback(islandMask, col, row) {
    for (let deltaRow = -5; deltaRow <= 5; deltaRow++) {
      for (let deltaCol = -5; deltaCol <= 5; deltaCol++) {
        if (Math.abs(deltaCol) + Math.abs(deltaRow) > 5) {
          continue;
        }
        const neighborCol = col + deltaCol;
        const neighborRow = row + deltaRow;
        if (
          !this.#inBounds(neighborCol, neighborRow) ||
          !islandMask[neighborRow][neighborCol]
        ) {
          return false;
        }
      }
    }
    return true;
  }

  static #isNearCastle(layout, col, row) {
    return (
      col >= layout.castleLeft - this.#CASTLE_GROUND_CLEARANCE &&
      col <= layout.castleRight + this.#CASTLE_REAR_GROUND_CLEARANCE &&
      row >= layout.castleTop - this.#CASTLE_GROUND_CLEARANCE &&
      row <= layout.castleBottom + this.#CASTLE_GROUND_CLEARANCE
    );
  }

  static #isNearCastleForRiver(layout, col, row) {
    return (
      col >= layout.castleLeft - this.#RIVER_CASTLE_SETBACK &&
      col <= layout.castleRight + this.#RIVER_CASTLE_SETBACK &&
      row >= layout.castleTop - this.#RIVER_CASTLE_SETBACK &&
      row <= layout.castleBottom + this.#RIVER_CASTLE_SETBACK
    );
  }

  static #isNearGate(layout, col, row) {
    return layout.entries.some(entry =>
      entry.gateRows.some(
        gateRow =>
          Math.max(
            Math.abs(entry.gateCol - col),
            Math.abs(gateRow - row),
          ) <= 1,
      ),
    );
  }

  static #isRiverTraversalCell(
    grid,
    tileMeta,
    layout,
    occupiedRiverCells,
    col,
    row,
  ) {
    if (!this.#inBounds(col, row)) {
      return false;
    }
    if (this.#touchesOccupiedRiver(occupiedRiverCells, col, row)) {
      return false;
    }
    if (this.#isNearCastleForRiver(layout, col, row)) {
      return false;
    }
    if (tileMeta[row][col].overpassId) {
      return false;
    }

    const tile = grid[row][col];
    return tile === TileType.GRASS || tile === TileType.PATH;
  }

  static #touchesOccupiedRiver(occupiedRiverCells, col, row) {
    for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
      for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
        if (
          occupiedRiverCells.has(
            this.#tileKey(col + deltaCol, row + deltaRow),
          )
        ) {
          return true;
        }
      }
    }
    return false;
  }

  static #directionFromStep(from, to) {
    const deltaCol = to.col - from.col;
    const deltaRow = to.row - from.row;
    if (deltaCol === 1 && deltaRow === 0) {
      return this.#DIRECTIONS.EAST;
    }
    if (deltaCol === -1 && deltaRow === 0) {
      return this.#DIRECTIONS.WEST;
    }
    if (deltaCol === 0 && deltaRow === 1) {
      return this.#DIRECTIONS.SOUTH;
    }
    if (deltaCol === 0 && deltaRow === -1) {
      return this.#DIRECTIONS.NORTH;
    }
    return this.#DIRECTIONS.NONE;
  }

  static #riverSourceHasEarthEnclosure(grid, route) {
    if (route.length < 2) {
      return false;
    }
    const source = route[0];
    const routeCells = new Set(
      route.map((cell) => this.#tileKey(cell.col, cell.row)),
    );
    for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
      for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
        if (deltaCol === 0 && deltaRow === 0) {
          continue;
        }
        const col = source.col + deltaCol;
        const row = source.row + deltaRow;
        if (routeCells.has(this.#tileKey(col, row))) {
          continue;
        }
        if (!this.#inBounds(col, row) || grid[row][col] !== TileType.GRASS) {
          return false;
        }
      }
    }
    return true;
  }

  static #riverTerminalDirection(grid, islandMask, layout, route) {
    if (route.length < this.#MIN_RIVER_TILES) {
      return null;
    }
    const terminal = route[route.length - 1];
    const previous = route[route.length - 2];
    if (
      grid[terminal.row][terminal.col] !== TileType.GRASS ||
      this.#isNearGate(layout, terminal.col, terminal.row) ||
      this.#isNearCastleForRiver(layout, terminal.col, terminal.row)
    ) {
      return null;
    }

    const deltaCol = terminal.col - previous.col;
    const deltaRow = terminal.row - previous.row;
    const outsideCol = terminal.col + deltaCol;
    const outsideRow = terminal.row + deltaRow;
    if (
      this.#inBounds(outsideCol, outsideRow) &&
      islandMask[outsideRow][outsideCol]
    ) {
      return null;
    }
    const crossCol = -deltaRow;
    const crossRow = deltaCol;
    for (const side of [-1, 1]) {
      if (
        !this.#inBounds(
          outsideCol + crossCol * side,
          outsideRow + crossRow * side,
        )
      ) {
        return null;
      }
    }
    return this.#directionFromStep(previous, terminal);
  }

  static #reconstructRiverRoute(parents, terminalKey) {
    const route = [];
    let key = terminalKey;
    while (key) {
      const [col, row] = key.split(',').map(Number);
      route.push({ col, row });
      key = parents.get(key) ?? null;
    }
    route.reverse();
    return route;
  }

  static #findRiverRoute(
    grid,
    tileMeta,
    islandMask,
    layout,
    source,
    occupiedRiverCells,
  ) {
    const sourceKey = this.#tileKey(source.col, source.row);
    const parents = new Map([[sourceKey, null]]);
    const queue = [{ ...source }];
    let queueIndex = 0;

    while (queueIndex < queue.length) {
      const current = queue[queueIndex++];
      const currentKey = this.#tileKey(current.col, current.row);
      const route = this.#reconstructRiverRoute(parents, currentKey);
      const terminalDirection = this.#riverTerminalDirection(
        grid,
        islandMask,
        layout,
        route,
      );
      if (
        terminalDirection &&
        this.#validateRiverPathCrossings(grid, tileMeta, route) &&
        this.#riverRouteKeepsIslandConnected(grid, route)
      ) {
        return { route, terminalDirection };
      }

      const neighbors = this.#shuffle([
        { col: current.col - 1, row: current.row },
        { col: current.col + 1, row: current.row },
        { col: current.col, row: current.row - 1 },
        { col: current.col, row: current.row + 1 },
      ]);
      for (const neighbor of neighbors) {
        const neighborKey = this.#tileKey(neighbor.col, neighbor.row);
        if (parents.has(neighborKey)) {
          continue;
        }
        if (
          !this.#isRiverTraversalCell(
            grid,
            tileMeta,
            layout,
            occupiedRiverCells,
            neighbor.col,
            neighbor.row,
          )
        ) {
          continue;
        }
        parents.set(neighborKey, currentKey);
        queue.push(neighbor);
      }
    }
    return null;
  }

  static #riverRouteKeepsIslandConnected(grid, route) {
    const trialGrid = grid.map(row => [...row]);
    for (const cell of route) {
      if (trialGrid[cell.row][cell.col] === TileType.GRASS) {
        trialGrid[cell.row][cell.col] = TileType.WATER;
      }
    }

    const land = [];
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        if (trialGrid[row][col] !== TileType.WATER) {
          land.push({ col, row });
        }
      }
    }
    return (
      land.length > 0 &&
      this.#findConnectedComponent(trialGrid, [land[0]]).size === land.length
    );
  }

  static #validateRiverPathCrossings(grid, tileMeta, route) {
    for (let index = 0; index < route.length; index++) {
      const cell = route[index];
      if (grid[cell.row][cell.col] !== TileType.PATH) {
        continue;
      }

      const start = index;
      while (
        index + 1 < route.length &&
        grid[route[index + 1].row][route[index + 1].col] === TileType.PATH
      ) {
        index++;
      }
      const end = index;
      if (end - start + 1 !== 2 || start === 0 || end >= route.length - 1) {
        return false;
      }
      if (
        route
          .slice(start, end + 1)
          .some(
            pathCell =>
              tileMeta[pathCell.row][pathCell.col].overpassId,
          )
      ) {
        return false;
      }

      const before = route[start - 1];
      const first = route[start];
      const last = route[end];
      const after = route[end + 1];
      const riverDirection = this.#directionFromStep(before, first);
      if (
        riverDirection === this.#DIRECTIONS.NONE ||
        this.#directionFromStep(first, last) !== riverDirection ||
        this.#directionFromStep(last, after) !== riverDirection
      ) {
        return false;
      }

      const pathDirection = tileMeta[first.row][first.col].direction;
      if (tileMeta[last.row][last.col].direction !== pathDirection) {
        return false;
      }
      const riverIsHorizontal =
        riverDirection === this.#DIRECTIONS.EAST ||
        riverDirection === this.#DIRECTIONS.WEST;
      const pathIsHorizontal =
        pathDirection === this.#DIRECTIONS.EAST ||
        pathDirection === this.#DIRECTIONS.WEST;
      if (riverIsHorizontal === pathIsHorizontal) {
        return false;
      }
    }
    return true;
  }

  static #materializeRiver(
    grid,
    heightmap,
    tileMeta,
    route,
    terminalDirection,
    riverIndex,
  ) {
    const cells = [];
    const cascades = [];
    let waterElevation = Math.max(
      this.#RIVER_WATER_DEPTH,
      heightmap[route[0].row][route[0].col] - this.#RIVER_SURFACE_INSET,
    );

    for (let index = 0; index < route.length; index++) {
      const cell = route[index];
      const tile = grid[cell.row][cell.col];
      const underBridge = tile === TileType.PATH;
      const terrainHeight = heightmap[cell.row][cell.col];
      const heightLimit = underBridge
        ? this.#PATH_HEIGHT - this.#BRIDGE_WATER_CLEARANCE
        : Math.max(
            this.#RIVER_WATER_DEPTH,
            terrainHeight - this.#RIVER_SURFACE_INSET,
          );
      const previousElevation = waterElevation;
      waterElevation = Math.min(waterElevation, heightLimit);
      const direction =
        index < route.length - 1
          ? this.#directionFromStep(cell, route[index + 1])
          : terminalDirection;

      cells.push({
        ...cell,
        direction,
        elevation: waterElevation,
        bedElevation: Math.max(
          0,
          waterElevation - this.#RIVER_WATER_DEPTH,
        ),
        terrainHeight,
        underBridge,
      });

      if (index > 0 && previousElevation - waterElevation > 0.04) {
        cascades.push({
          from: { ...route[index - 1] },
          to: { ...cell },
          direction: this.#directionFromStep(route[index - 1], cell),
          topElevation: previousElevation,
          bottomElevation: waterElevation,
        });
      }

      if (!underBridge) {
        this.#setTile(grid, tileMeta, cell.col, cell.row, TileType.WATER, {
          surfaceType: 'WATER',
          baseHeight: waterElevation,
          direction,
          riverSourceCover: index === 0,
        });
        heightmap[cell.row][cell.col] = waterElevation;
      }
    }

    const terminal = cells[cells.length - 1];
    return {
      id: `river-${riverIndex + 1}`,
      kind: RIVER_KIND.WATER,
      source: {
        col: cells[0].col,
        row: cells[0].row,
        terrainHeight: cells[0].terrainHeight,
      },
      cells,
      cascades,
      upstreamLength: cells.length - 2,
      waterfall: {
        col: terminal.col,
        row: terminal.row,
        direction: terminalDirection,
        topElevation: terminal.elevation,
        bottomElevation: Math.min(
          this.#TERMINAL_WATERFALL_BOTTOM,
          terminal.elevation - 11.5,
        ),
      },
    };
  }

  static #generateRivers(
    grid,
    heightmap,
    tileMeta,
    layout,
    islandMask,
    requestedNumRivers,
  ) {
    const riverCount = this.#selectRiverCount(requestedNumRivers);
    if (riverCount === 0) {
      return [];
    }

    const sourceCandidates = [];
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        if (
          grid[row][col] === TileType.GRASS &&
          heightmap[row][col] >= 2 &&
          this.#hasRiverSourceSetback(islandMask, col, row) &&
          !this.#isNearCastleForRiver(layout, col, row)
        ) {
          sourceCandidates.push({ col, row, height: heightmap[row][col] });
        }
      }
    }
    this.#shuffle(sourceCandidates);
    sourceCandidates.sort((left, right) => right.height - left.height);

    const rivers = [];
    const occupiedRiverCells = new Set();
    for (const source of sourceCandidates) {
      if (rivers.length >= riverCount) {
        break;
      }
      if (
        this.#touchesOccupiedRiver(
          occupiedRiverCells,
          source.col,
          source.row,
        )
      ) {
        continue;
      }
      const result = this.#findRiverRoute(
        grid,
        tileMeta,
        islandMask,
        layout,
        source,
        occupiedRiverCells,
      );
      if (!result) {
        continue;
      }
      if (!this.#riverSourceHasEarthEnclosure(grid, result.route)) {
        continue;
      }
      const river = this.#materializeRiver(
        grid,
        heightmap,
        tileMeta,
        result.route,
        result.terminalDirection,
        rivers.length,
      );
      rivers.push(river);
      for (const cell of result.route) {
        occupiedRiverCells.add(this.#tileKey(cell.col, cell.row));
      }
    }
    return rivers;
  }

  static #assignRiverKinds(rivers) {
    if (
      rivers.length === 0 ||
      rivers.length > this.#MAX_LAVA_ELIGIBLE_RIVERS ||
      this.#rng(1, this.#LAVA_ISLAND_CHANCE) !== 1
    ) {
      return;
    }

    const lavaRiverCount = this.#rng(
      1,
      Math.min(this.#MAX_LAVA_ELIGIBLE_RIVERS, rivers.length),
    );
    for (const river of this.#shuffle([...rivers]).slice(0, lavaRiverCount)) {
      river.kind = RIVER_KIND.LAVA;
    }
  }

  static #raiseLavaSurfaces(heightmap, tileMeta, rivers) {
    for (const river of rivers) {
      if (river.kind !== RIVER_KIND.LAVA) {
        continue;
      }

      let previousElevation = Number.POSITIVE_INFINITY;
      const cascades = [];
      for (const [index, cell] of river.cells.entries()) {
        const heightLimit = cell.underBridge
          ? this.#PATH_HEIGHT - this.#BRIDGE_WATER_CLEARANCE
          : Math.max(
              this.#RIVER_WATER_DEPTH,
              cell.terrainHeight - this.#LAVA_SURFACE_INSET,
            );
        const elevation = Math.min(previousElevation, heightLimit);
        cell.elevation = elevation;
        cell.bedElevation = Math.max(
          0,
          elevation - this.#RIVER_WATER_DEPTH,
        );

        if (!cell.underBridge) {
          heightmap[cell.row][cell.col] = elevation;
          tileMeta[cell.row][cell.col].baseHeight = elevation;
          tileMeta[cell.row][cell.col].riverSourceCover = index === 0;
        }

        if (index > 0 && previousElevation - elevation > 0.04) {
          const previous = river.cells[index - 1];
          cascades.push({
            from: { col: previous.col, row: previous.row },
            to: { col: cell.col, row: cell.row },
            direction: this.#directionFromStep(previous, cell),
            topElevation: previousElevation,
            bottomElevation: elevation,
          });
        }
        previousElevation = elevation;
      }

      river.cascades = cascades;
      river.waterfall.topElevation = river.cells.at(-1).elevation;
    }
  }

  static #riverSurfaceInset(river) {
    return river.kind === RIVER_KIND.LAVA
      ? this.#LAVA_SURFACE_INSET
      : this.#RIVER_SURFACE_INSET;
  }

  static #materializeRiverBanks(
    grid,
    heightmap,
    tileMeta,
    islandMask,
    riverData,
  ) {
    const directionOffsets = {
      [this.#DIRECTIONS.NORTH]: [0, -1],
      [this.#DIRECTIONS.EAST]: [1, 0],
      [this.#DIRECTIONS.SOUTH]: [0, 1],
      [this.#DIRECTIONS.WEST]: [-1, 0],
    };
    const riverCellKeys = new Set(
      riverData.flatMap((river) =>
        river.cells.map((cell) => this.#tileKey(cell.col, cell.row)),
      ),
    );

    for (const river of riverData) {
      for (const cell of river.cells) {
        if (cell.underBridge) {
          continue;
        }
        const [deltaCol, deltaRow] =
          directionOffsets[cell.direction] ?? [0, 0];
        const crossCol = -deltaRow;
        const crossRow = deltaCol;
        const bankHeight = Math.ceil(
          cell.elevation + this.#riverSurfaceInset(river),
        );

        for (const side of [-1, 1]) {
          const col = cell.col + crossCol * side;
          const row = cell.row + crossRow * side;
          const key = this.#tileKey(col, row);
          if (
            !this.#inBounds(col, row) ||
            riverCellKeys.has(key) ||
            (grid[row][col] !== TileType.GRASS &&
              grid[row][col] !== TileType.WATER)
          ) {
            continue;
          }
          if (grid[row][col] === TileType.WATER) {
            this.#setTile(grid, tileMeta, col, row, TileType.GRASS, {
              surfaceType: 'GRASS',
              baseHeight: bankHeight,
              shape: TILE_SHAPE.FLAT,
              direction: this.#DIRECTIONS.NONE,
            });
          }
          islandMask[row][col] = true;
          heightmap[row][col] = Math.max(heightmap[row][col], bankHeight);
        }
      }

      const terminal = river.cells.at(-1);
      const [waterfallCol, waterfallRow] =
        directionOffsets[river.waterfall.direction] ?? [0, 0];
      const waterfallCrossCol = -waterfallRow;
      const waterfallCrossRow = waterfallCol;
      const waterfallBankHeight = Math.ceil(
        terminal.elevation + this.#riverSurfaceInset(river),
      );
      for (const side of [-1, 1]) {
        const col =
          terminal.col + waterfallCol + waterfallCrossCol * side;
        const row =
          terminal.row + waterfallRow + waterfallCrossRow * side;
        const key = this.#tileKey(col, row);
        if (
          !this.#inBounds(col, row) ||
          riverCellKeys.has(key) ||
          (grid[row][col] !== TileType.GRASS &&
            grid[row][col] !== TileType.WATER)
        ) {
          continue;
        }
        if (grid[row][col] === TileType.WATER) {
          this.#setTile(grid, tileMeta, col, row, TileType.GRASS, {
            surfaceType: 'GRASS',
            baseHeight: waterfallBankHeight,
            shape: TILE_SHAPE.FLAT,
            direction: this.#DIRECTIONS.NONE,
          });
        }
        islandMask[row][col] = true;
        heightmap[row][col] = Math.max(
          heightmap[row][col],
          waterfallBankHeight,
        );
      }

      const source = river.cells[0];
      const sourceBankHeight = Math.ceil(
        source.elevation + this.#riverSurfaceInset(river),
      );
      for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
        for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
          if (deltaCol === 0 && deltaRow === 0) {
            continue;
          }
          const bankCol = source.col + deltaCol;
          const bankRow = source.row + deltaRow;
          const bankKey = this.#tileKey(bankCol, bankRow);
          if (
            !this.#inBounds(bankCol, bankRow) ||
            riverCellKeys.has(bankKey) ||
            (grid[bankRow][bankCol] !== TileType.GRASS &&
              grid[bankRow][bankCol] !== TileType.WATER)
          ) {
            continue;
          }
          if (grid[bankRow][bankCol] === TileType.WATER) {
            this.#setTile(
              grid,
              tileMeta,
              bankCol,
              bankRow,
              TileType.GRASS,
              {
                surfaceType: 'GRASS',
                baseHeight: sourceBankHeight,
                shape: TILE_SHAPE.FLAT,
                direction: this.#DIRECTIONS.NONE,
              },
            );
          }
          islandMask[bankRow][bankCol] = true;
          heightmap[bankRow][bankCol] = Math.max(
            heightmap[bankRow][bankCol],
            sourceBankHeight,
          );
        }
      }

      for (const cascade of river.cascades) {
        const [deltaCol, deltaRow] =
          directionOffsets[cascade.direction] ?? [0, 0];
        const crossCol = -deltaRow;
        const crossRow = deltaCol;
        const bankHeight = Math.ceil(cascade.topElevation);
        for (const anchor of [cascade.from, cascade.to]) {
          for (const side of [-1, 1]) {
            const col = anchor.col + crossCol * side;
            const row = anchor.row + crossRow * side;
            if (
              !this.#inBounds(col, row) ||
              grid[row][col] !== TileType.GRASS
            ) {
              continue;
            }
            heightmap[row][col] = Math.max(heightmap[row][col], bankHeight);
          }
        }
      }
    }
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

  static #applyTerrainBridgeDips(
    grid,
    heightmap,
    tileMeta,
    riverData,
    mergeZones,
  ) {
    const riverBridgeCells = new Set(
      riverData.flatMap((river) =>
        river.cells
          .filter((cell) => cell.underBridge)
          .map((cell) => this.#tileKey(cell.col, cell.row)),
      ),
    );
    const stations = [];
    const seenStations = new Set();

    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        if (grid[row][col] !== TileType.PATH) {
          continue;
        }
        const metadata = tileMeta[row][col];
        if (
          metadata.shape !== TILE_SHAPE.FLAT ||
          metadata.overpassId ||
          heightmap[row][col] !== this.#PATH_HEIGHT
        ) {
          continue;
        }

        const horizontal =
          metadata.direction === this.#DIRECTIONS.EAST ||
          metadata.direction === this.#DIRECTIONS.WEST;
        const vertical =
          metadata.direction === this.#DIRECTIONS.NORTH ||
          metadata.direction === this.#DIRECTIONS.SOUTH;
        if (!horizontal && !vertical) {
          continue;
        }

        const mate = horizontal
          ? this.#findLaneMateRow(
              grid,
              tileMeta,
              col,
              row,
              metadata.direction,
            )
          : this.#findLaneMateCol(
              grid,
              tileMeta,
              col,
              row,
              metadata.direction,
            );
        if (mate === null) {
          continue;
        }

        const axis = horizontal ? 'HORIZONTAL' : 'VERTICAL';
        const cross = Math.min(horizontal ? row : col, mate);
        const coordinate = horizontal ? col : row;
        const stationKey = `${axis}:${cross}:${coordinate}`;
        if (seenStations.has(stationKey)) {
          continue;
        }
        seenStations.add(stationKey);

        const cells = this.#pathStationCells(axis, cross, coordinate);
        if (
          cells.some(
            (cell) =>
              mergeZones.has(this.#tileKey(cell.col, cell.row)) ||
              riverBridgeCells.has(this.#tileKey(cell.col, cell.row)) ||
              tileMeta[cell.row][cell.col].overpassId ||
              tileMeta[cell.row][cell.col].shape !== TILE_SHAPE.FLAT ||
              heightmap[cell.row][cell.col] !== this.#PATH_HEIGHT ||
              this.#classifyRenderMode(
                grid,
                heightmap,
                tileMeta,
                cell.col,
                cell.row,
              ) !== 'BRIDGE',
          )
        ) {
          continue;
        }

        const lateralCells = this.#pathLateralCells(
          grid,
          tileMeta,
          cells[0].col,
          cells[0].row,
        );
        if (
          !lateralCells ||
          lateralCells.some(
            (cell) =>
              !this.#inBounds(cell.col, cell.row) ||
              grid[cell.row][cell.col] !== TileType.GRASS ||
              heightmap[cell.row][cell.col] !==
                this.#TERRAIN_BRIDGE_DIP_ELEVATION,
          )
        ) {
          continue;
        }

        stations.push({
          axis,
          cross,
          coordinate,
          direction: metadata.direction,
        });
      }
    }

    const groupedStations = new Map();
    for (const station of stations) {
      const key = `${station.axis}:${station.cross}:${station.direction}`;
      const group = groupedStations.get(key) ?? [];
      group.push(station);
      groupedStations.set(key, group);
    }

    const eligibleSpans = [];
    for (const group of groupedStations.values()) {
      group.sort((left, right) => left.coordinate - right.coordinate);
      let run = [];
      const finishRun = () => {
        if (run.length >= this.#TERRAIN_BRIDGE_DIP_MIN_SPAN) {
          const span = {
            axis: run[0].axis,
            cross: run[0].cross,
            direction: run[0].direction,
            start: run[0].coordinate,
            end: run[run.length - 1].coordinate,
          };
          if (
            this.#pathDipLandingFits(
              grid,
              heightmap,
              tileMeta,
              riverBridgeCells,
              mergeZones,
              span,
              span.start - 1,
            ) &&
            this.#pathDipLandingFits(
              grid,
              heightmap,
              tileMeta,
              riverBridgeCells,
              mergeZones,
              span,
              span.end + 1,
            )
          ) {
            eligibleSpans.push(span);
          }
        }
        run = [];
      };

      for (const station of group) {
        if (
          run.length &&
          station.coordinate !== run[run.length - 1].coordinate + 1
        ) {
          finishRun();
        }
        run.push(station);
      }
      finishRun();
    }

    eligibleSpans.sort(
      (left, right) =>
        left.axis.localeCompare(right.axis) ||
        left.cross - right.cross ||
        left.start - right.start,
    );
    const plans = [];
    for (const span of eligibleSpans) {
      if (this.#rng(1, 100) > this.#TERRAIN_BRIDGE_DIP_CHANCE) {
        continue;
      }
      const plan = this.#buildTerrainBridgeDipPlan(span, plans.length);
      this.#applyTerrainBridgeDipPlan(heightmap, tileMeta, plan);
      plans.push(plan);
    }
    return plans;
  }

  static #pathStationCells(axis, cross, coordinate) {
    return axis === 'HORIZONTAL'
      ? [
          { col: coordinate, row: cross },
          { col: coordinate, row: cross + 1 },
        ]
      : [
          { col: cross, row: coordinate },
          { col: cross + 1, row: coordinate },
        ];
  }

  static #pathDipLandingFits(
    grid,
    heightmap,
    tileMeta,
    riverBridgeCells,
    mergeZones,
    span,
    coordinate,
  ) {
    const cells = this.#pathStationCells(span.axis, span.cross, coordinate);
    if (
      cells.some(
        (cell) =>
          !this.#inBounds(cell.col, cell.row) ||
          grid[cell.row][cell.col] !== TileType.PATH ||
          mergeZones.has(this.#tileKey(cell.col, cell.row)) ||
          riverBridgeCells.has(this.#tileKey(cell.col, cell.row)) ||
          tileMeta[cell.row][cell.col].overpassId ||
          tileMeta[cell.row][cell.col].shape !== TILE_SHAPE.FLAT ||
          tileMeta[cell.row][cell.col].direction !== span.direction ||
          heightmap[cell.row][cell.col] !== this.#PATH_HEIGHT ||
          this.#classifyRenderMode(
            grid,
            heightmap,
            tileMeta,
            cell.col,
            cell.row,
          ) !== 'SOLID',
      )
    ) {
      return false;
    }
    const lateralCells = this.#pathLateralCells(
      grid,
      tileMeta,
      cells[0].col,
      cells[0].row,
    );
    return Boolean(
      lateralCells && !this.#isPathTurnPosition(grid, lateralCells),
    );
  }

  static #buildTerrainBridgeDipPlan(span, index) {
    const firstRiseDirection =
      span.axis === 'HORIZONTAL'
        ? SLOPE_DIRECTION.WEST
        : SLOPE_DIRECTION.NORTH;
    const lastRiseDirection =
      span.axis === 'HORIZONTAL'
        ? SLOPE_DIRECTION.EAST
        : SLOPE_DIRECTION.SOUTH;
    const rampTiles = this.#TERRAIN_BRIDGE_DIP_RAMP_TILES;
    const rampStep =
      (this.#PATH_HEIGHT - this.#TERRAIN_BRIDGE_DIP_ELEVATION) /
      rampTiles;
    const slopeCells = [];
    for (let offset = 0; offset < rampTiles; offset += 1) {
      const highHeight = this.#PATH_HEIGHT - offset * rampStep;
      const lowHeight = highHeight - rampStep;
      slopeCells.push(
        ...this.#pathStationCells(
          span.axis,
          span.cross,
          span.start + offset,
        ).map((cell) => ({
          ...cell,
          lowHeight,
          highHeight,
          riseDirection: firstRiseDirection,
        })),
        ...this.#pathStationCells(
          span.axis,
          span.cross,
          span.end - offset,
        ).map((cell) => ({
          ...cell,
          lowHeight,
          highHeight,
          riseDirection: lastRiseDirection,
        })),
      );
    }
    const flatCells = [];
    for (
      let coordinate = span.start + rampTiles;
      coordinate <= span.end - rampTiles;
      coordinate += 1
    ) {
      flatCells.push(
        ...this.#pathStationCells(span.axis, span.cross, coordinate),
      );
    }
    return {
      id: `terrain-path-dip-${index}`,
      ...span,
      elevation: this.#TERRAIN_BRIDGE_DIP_ELEVATION,
      rampTiles,
      slopeCells,
      flatCells,
      landingCells: [
        ...this.#pathStationCells(span.axis, span.cross, span.start - 1),
        ...this.#pathStationCells(span.axis, span.cross, span.end + 1),
      ],
    };
  }

  static #applyTerrainBridgeDipPlan(heightmap, tileMeta, plan) {
    for (const cell of plan.flatCells) {
      heightmap[cell.row][cell.col] = plan.elevation;
      tileMeta[cell.row][cell.col] = {
        ...tileMeta[cell.row][cell.col],
        baseHeight: plan.elevation,
        shape: TILE_SHAPE.FLAT,
        pathDipId: plan.id,
      };
    }
    for (const cell of plan.slopeCells) {
      const centerHeight = (cell.lowHeight + cell.highHeight) / 2;
      heightmap[cell.row][cell.col] = centerHeight;
      tileMeta[cell.row][cell.col] = {
        ...tileMeta[cell.row][cell.col],
        baseHeight: centerHeight,
        shape: TILE_SHAPE.SLOPE,
        slope: {
          lowHeight: cell.lowHeight,
          highHeight: cell.highHeight,
          riseDirection: cell.riseDirection,
        },
        pathDipId: plan.id,
      };
    }
  }

  static #applyHeightsToMetadata(grid, tileMeta, heightmap, riverData) {
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        tileMeta[row][col] = {
          ...tileMeta[row][col],
          baseHeight: heightmap[row][col],
          renderMode: 'SOLID',
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

    this.#applyPathRenderModes(grid, heightmap, tileMeta);
    this.#assignBridgeGround(tileMeta, heightmap, riverData);
  }

  static #materializePathSupports(grid, heightmap, tileMeta, riverData) {
    const riverCells = new Set(
      riverData.flatMap((river) =>
        river.cells.map((cell) => this.#tileKey(cell.col, cell.row)),
      ),
    );
    const processedStations = new Set();
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        if (grid[row][col] !== TileType.PATH) {
          continue;
        }
        if (tileMeta[row][col].shape === TILE_SHAPE.SLOPE) {
          continue;
        }
        if (tileMeta[row][col].overpassId) {
          continue;
        }
        const lateralCells = this.#pathLateralCells(
          grid,
          tileMeta,
          col,
          row,
        );
        if (!lateralCells) {
          continue;
        }
        const direction = tileMeta[row][col].direction;
        const axis =
          direction === this.#DIRECTIONS.EAST ||
          direction === this.#DIRECTIONS.WEST
            ? 'H'
            : 'V';
        const stationKey = `${axis}:${lateralCells
          .map((cell) => this.#tileKey(cell.col, cell.row))
          .sort()
          .join('|')}`;
        if (processedStations.has(stationKey)) {
          continue;
        }
        processedStations.add(stationKey);

        const pathHeight = heightmap[row][col];
        const supportedSides = lateralCells.filter(({ col: sideCol, row: sideRow }) =>
          this.#hasPathSideBlock(
            grid,
            heightmap,
            sideCol,
            sideRow,
            pathHeight,
          )
        );
        if (
          supportedSides.length !== 1 &&
          !this.#isPathTurnPosition(grid, lateralCells)
        ) {
          continue;
        }

        for (const { col: sideCol, row: sideRow } of lateralCells) {
          if (
            this.#hasPathSideBlock(
              grid,
              heightmap,
              sideCol,
              sideRow,
              pathHeight,
            ) ||
            !this.#inBounds(sideCol, sideRow) ||
            riverCells.has(this.#tileKey(sideCol, sideRow))
          ) {
            continue;
          }
          this.#setTile(grid, tileMeta, sideCol, sideRow, TileType.GRASS, {
            surfaceType: 'GRASS',
            baseHeight: pathHeight,
          });
          heightmap[sideRow][sideCol] = pathHeight;
        }
      }
    }
  }

  static #applyPathRenderModes(grid, heightmap, tileMeta) {
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        if (grid[row][col] !== TileType.PATH) {
          continue;
        }
        tileMeta[row][col].renderMode = this.#classifyRenderMode(
          grid,
          heightmap,
          tileMeta,
          col,
          row,
        );
      }
    }
  }

  static #assignBridgeGround(tileMeta, heightmap, riverData) {
    const riverBridgeCells = new Set(
      riverData.flatMap((river) =>
        river.cells
          .filter((cell) => cell.underBridge)
          .map((cell) => this.#tileKey(cell.col, cell.row)),
      ),
    );
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        if (tileMeta[row][col].renderMode !== 'BRIDGE') {
          continue;
        }
        tileMeta[row][col].bridgeGroundHeight = riverBridgeCells.has(
          this.#tileKey(col, row),
        )
          ? null
          : Math.max(1, heightmap[row][col] - 1);
      }
    }
  }

  static #classifyRenderMode(grid, heightmap, tileMeta, col, row) {
    const tile = grid[row][col];
    if (tile !== TileType.PATH) {
      return 'SOLID';
    }
    if (tileMeta[row][col].shape === TILE_SHAPE.SLOPE) {
      return 'SOLID';
    }
    if (
      tileMeta[row][col].overpassId &&
      !tileMeta[row][col].overpass
    ) {
      return 'SOLID';
    }

    const lateralCells = this.#pathLateralCells(grid, tileMeta, col, row);
    if (!lateralCells) {
      return 'SOLID';
    }
    if (this.#isPathTurnPosition(grid, lateralCells)) {
      return 'SOLID';
    }

    const pathHeight = heightmap[row][col];
    const hasLateralSupport = lateralCells.some(
      ({ col: sideCol, row: sideRow }) =>
        this.#hasPathSideBlock(
          grid,
          heightmap,
          sideCol,
          sideRow,
          pathHeight,
        ),
    );
    return hasLateralSupport ? 'SOLID' : 'BRIDGE';
  }

  static #isPathTurnPosition(grid, lateralCells) {
    return lateralCells.some(
      ({ col, row }) =>
        this.#inBounds(col, row) && this.#isRouteTile(grid[row][col]),
    );
  }

  static #hasPathSideBlock(grid, heightmap, col, row, pathHeight) {
    if (!this.#inBounds(col, row) || grid[row][col] === TileType.WATER) {
      return false;
    }
    return heightmap[row][col] >= pathHeight;
  }

  static #pathLateralCells(grid, tileMeta, col, row) {
    const direction = tileMeta[row][col].direction;
    if (direction === this.#DIRECTIONS.EAST || direction === this.#DIRECTIONS.WEST) {
      const mateRow = this.#findLaneMateRow(grid, tileMeta, col, row, direction);
      if (mateRow === null) {
        return null;
      }
      return [
        { col, row: Math.min(row, mateRow) - 1 },
        { col, row: Math.max(row, mateRow) + 1 },
      ];
    }

    if (direction === this.#DIRECTIONS.NORTH || direction === this.#DIRECTIONS.SOUTH) {
      const mateCol = this.#findLaneMateCol(grid, tileMeta, col, row, direction);
      if (mateCol === null) {
        return null;
      }
      return [
        { col: Math.min(col, mateCol) - 1, row },
        { col: Math.max(col, mateCol) + 1, row },
      ];
    }

    return null;
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

  static #routeNodeKey(col2, row2, elevation = this.#PATH_HEIGHT) {
    return `${col2},${row2},${Math.round(elevation * 1000) / 1000}`;
  }

  static #appendRouteWaypoint(waypoints, col2, row2) {
    const previous = waypoints[waypoints.length - 1];
    if (previous?.col2 === col2 && previous?.row2 === row2) {
      return;
    }
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
    const firstKey = this.#routeNodeKey(
      first.col2,
      first.row2,
      first.elevation,
    );
    const secondKey = this.#routeNodeKey(
      second.col2,
      second.row2,
      second.elevation,
    );
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
      const [col2, row2, elevation] = key.split(',').map(Number);
      route.push({ col: col2 / 2, row: row2 / 2, elevation });
      if (key === targetKey) {
        return route;
      }

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
      const distancesToCastle = new Array(route.length).fill(0);
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
      for (let index = route.length - 2; index >= 0; index--) {
        distancesToCastle[index] =
          distancesToCastle[index + 1] +
          Math.hypot(
            route[index + 1].col - route[index].col,
            route[index + 1].row - route[index].row,
          );
      }

      let distanceFromGate = 0;
      for (let index = 1; index < route.length - 1; index++) {
        const current = route[index];
        const next = route[index + 1];
        const previous = route[index - 1];
        distanceFromGate += Math.hypot(
          current.col - previous.col,
          current.row - previous.row,
        );
        if (
          distanceFromGate <= this.#MIN_ARROW_GATE_CLEARANCE ||
          distancesToCastle[index] <= this.#MIN_ARROW_CASTLE_CLEARANCE
        ) {
          continue;
        }
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
        const colParity = Math.abs(col2) % 2;
        const rowParity = Math.abs(row2) % 2;
        if (startsTurn) {
          if (colParity !== 1 || rowParity !== 1) {
            continue;
          }
        } else if (colParity === rowParity) {
          continue;
        }

        const axis2 = dc === 0 ? row2 : col2;
        if (!startsTurn && Math.abs(axis2) % 4 !== 0) continue;

        const elevation = current.elevation ?? this.#PATH_HEIGHT;
        const nextElevation = next.elevation ?? this.#PATH_HEIGHT;
        const segmentLength = Math.hypot(
          next.col - current.col,
          next.row - current.row,
        );
        const surfacePitch = segmentLength
          ? (Math.atan2(nextElevation - elevation, segmentLength) * 180) /
            Math.PI
          : 0;
        const key = `${col2 / 2},${row2 / 2},${elevation}`;
        const arrows = arrowData.get(key) ?? [];
        arrows.push({
          dc,
          dr,
          elevation,
          marker: startsTurn ? 'turn' : 'arrow',
          pathIdx,
          surfacePitch,
        });
        arrowData.set(key, arrows);
      }
    });

    return arrowData;
  }

  static #buildRouteData(layout) {
    const graph = new Map();
    const rawRoutes = layout.entries.map((entry, pathIdx) => {
      const route = this.#applyRouteElevations(
        this.#expandRouteWaypoints(
          this.#buildRouteWaypoints(layout, entry),
        ),
        pathIdx,
        layout.overpassPlan,
        layout.pathDipPlans,
      );
      for (let index = 1; index < route.length; index++) {
        this.#connectRouteNodes(graph, route[index - 1], route[index]);
      }
      return route;
    });
    const targetKey = this.#routeNodeKey(
      layout.castleEntranceCol * 2,
      layout.pathRows[0] + layout.pathRows[1],
      this.#PATH_HEIGHT,
    );
    const distances = this.#buildRouteDistances(graph, targetKey);
    const routes = rawRoutes.map(route =>
      this.#followQuickestRoute(
        graph,
        distances,
        this.#routeNodeKey(
          route[0].col2,
          route[0].row2,
          route[0].elevation,
        ),
        targetKey,
      )
    );

    return { routes, arrowData: this.#buildArrowData(routes) };
  }

  static #applyRouteElevations(route, pathIdx, overpassPlan, pathDipPlans) {
    const crossingCol2 = overpassPlan?.crossing.col * 2 + 1;
    const crossingRow2 = overpassPlan?.crossing.row * 2 + 1;
    return route.map(point => {
      let elevation = this.#terrainPathDipElevation(point, pathDipPlans);
      if (
        overpassPlan &&
        pathIdx === overpassPlan.upperPathIdx &&
        point.col2 === crossingCol2
      ) {
        const distance = Math.abs(point.row2 - crossingRow2) / 2;
        if (distance <= 2) {
          elevation = overpassPlan.deckElevation;
        } else if (distance <= 2 + this.#OVERPASS_RAMP_TILES) {
          elevation =
            overpassPlan.deckElevation -
            (distance - 2) * this.#OVERPASS_HALF_STEP;
        }
      }
      return { ...point, elevation };
    });
  }

  static #terrainPathDipElevation(point, plans = []) {
    for (const plan of plans) {
      const crossCoordinate2 = plan.cross * 2 + 1;
      const pointCrossCoordinate2 =
        plan.axis === 'HORIZONTAL' ? point.row2 : point.col2;
      if (pointCrossCoordinate2 !== crossCoordinate2) {
        continue;
      }

      const pointCoordinate2 =
        plan.axis === 'HORIZONTAL' ? point.col2 : point.row2;
      const rampTiles = plan.rampTiles ?? 1;
      const startEdge2 = plan.start * 2 - 1;
      const startLowEdge2 = (plan.start + rampTiles) * 2 - 1;
      const endLowEdge2 = (plan.end - rampTiles) * 2 + 1;
      const endEdge2 = plan.end * 2 + 1;
      if (pointCoordinate2 < startEdge2 || pointCoordinate2 > endEdge2) {
        continue;
      }
      if (pointCoordinate2 <= startLowEdge2) {
        return (
          this.#PATH_HEIGHT -
          ((pointCoordinate2 - startEdge2) /
            (2 * rampTiles)) *
            (this.#PATH_HEIGHT - plan.elevation)
        );
      }
      if (pointCoordinate2 <= endLowEdge2) {
        return plan.elevation;
      }
      return (
        plan.elevation +
        ((pointCoordinate2 - endLowEdge2) /
          (2 * rampTiles)) *
          (this.#PATH_HEIGHT - plan.elevation)
      );
    }
    return this.#PATH_HEIGHT;
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
    if (!this.#inBounds(col, row)) {
      return false;
    }
    if (grid[row][col] !== TileType.GRASS) {
      return false;
    }
    if (tileMeta[row][col].shape !== TILE_SHAPE.FLAT) {
      return false;
    }
    if (!Number.isFinite(heightmap[row][col])) {
      return false;
    }

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
        if (this.#isRouteTile(grid[neighborRow][neighborCol])) {
          return false;
        }
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

    if (!candidates.length) {
      return [];
    }

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
      if (occupied.has(key) || selected.length >= targetCount) {
        return;
      }
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
    if (!this.#inBounds(col, row)) {
      return false;
    }
    if (grid[row][col] !== TileType.GRASS) {
      return false;
    }
    if (tileMeta[row][col].shape !== TILE_SHAPE.FLAT) {
      return false;
    }
    if (!Number.isFinite(heightmap[row][col])) {
      return false;
    }
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
    if (!Number.isFinite(mergeCol)) {
      return false;
    }
    return col >= mergeCol && col <= mergeCol + 1 && row >= layout.pathRows[0] && row <= layout.pathRows[1];
  }

  static #isWithinMergeCorridor(layout, col) {
    const mergeCol = layout.entries[0]?.mergeCol;
    return Number.isFinite(mergeCol) && col >= mergeCol && col <= mergeCol + 1;
  }

  static #routesShareMergeCellAtRow(
    firstCells,
    secondCells,
    layout,
    row,
  ) {
    const mergeCol = layout.entries[0]?.mergeCol;
    if (!Number.isFinite(mergeCol)) {
      return false;
    }
    return [mergeCol, mergeCol + 1].some((col) => {
      const key = this.#tileKey(col, row);
      return firstCells.has(key) && secondCells.has(key);
    });
  }

  static #isPlannedMergeContact(
    firstCells,
    secondCells,
    layout,
    firstCell,
    secondCell,
  ) {
    if (
      !this.#isWithinMergeCorridor(layout, firstCell.col) &&
      !this.#isWithinMergeCorridor(layout, secondCell.col)
    ) {
      return false;
    }
    return [firstCell.row, secondCell.row].some((row) =>
      this.#routesShareMergeCellAtRow(
        firstCells,
        secondCells,
        layout,
        row,
      ),
    );
  }

  static #isWithinOverpassCrossing(overpassPlan, col, row) {
    if (!overpassPlan) {
      return false;
    }
    const { crossing } = overpassPlan;
    return (
      col >= crossing.col &&
      col < crossing.col + crossing.width &&
      row >= crossing.row &&
      row < crossing.row + crossing.depth
    );
  }

  static #findUnexpectedRouteConnection(
    routeCellsByPath,
    layout,
    overpassPlan,
  ) {
    const neighborOffsets = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (let firstIndex = 0; firstIndex < routeCellsByPath.length; firstIndex++) {
      const firstCells = routeCellsByPath[firstIndex].routeCells;
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < routeCellsByPath.length;
        secondIndex++
      ) {
        const secondCells = routeCellsByPath[secondIndex].routeCells;
        for (const key of firstCells) {
          const [col, row] = key.split(',').map(Number);
          for (const [deltaCol, deltaRow] of neighborOffsets) {
            const neighborCol = col + deltaCol;
            const neighborRow = row + deltaRow;
            if (
              !secondCells.has(this.#tileKey(neighborCol, neighborRow))
            ) {
              continue;
            }
            if (
              this.#isPlannedMergeContact(
                firstCells,
                secondCells,
                layout,
                { col, row },
                { col: neighborCol, row: neighborRow },
              ) ||
              this.#isWithinOverpassCrossing(overpassPlan, col, row) ||
              this.#isWithinOverpassCrossing(
                overpassPlan,
                neighborCol,
                neighborRow,
              )
            ) {
              continue;
            }
            return {
              firstPathIndex: firstIndex,
              secondPathIndex: secondIndex,
              col,
              row,
            };
          }
        }
      }
    }
    return null;
  }

  static #validateRouteSeparation(routeCellsByPath, layout) {
    const connection = this.#findUnexpectedRouteConnection(
      routeCellsByPath,
      layout,
      layout.overpassPlan,
    );
    if (connection) {
      throw new UnexpectedPathConnectionError(connection);
    }
  }

  static #hasInsufficientParallelPathClearance(grid, layout) {
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
          return true;
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
          return true;
        }
      }
    }
    return false;
  }

  static #validateParallelPathClearance(grid, layout) {
    if (this.#hasInsufficientParallelPathClearance(grid, layout)) {
      throw new InsufficientParallelPathSpacingError();
    }
  }

  static #findUnexpectedFlatPathCrossing(grid, overpassPlan) {
    const isRoutePair = (firstCol, firstRow, secondCol, secondRow) =>
      this.#inBounds(firstCol, firstRow) &&
      this.#inBounds(secondCol, secondRow) &&
      this.#isRouteTile(grid[firstRow][firstCol]) &&
      this.#isRouteTile(grid[secondRow][secondCol]);

    for (let row = 0; row < this.#MAP_ROWS - 1; row += 1) {
      for (let col = 0; col < this.#MAP_COLS - 1; col += 1) {
        if (
          !isRoutePair(col, row, col + 1, row) ||
          !isRoutePair(col, row + 1, col + 1, row + 1)
        ) {
          continue;
        }
        const continuesNorth = isRoutePair(
          col,
          row - 1,
          col + 1,
          row - 1,
        );
        const continuesSouth = isRoutePair(
          col,
          row + 2,
          col + 1,
          row + 2,
        );
        const continuesWest = isRoutePair(
          col - 1,
          row,
          col - 1,
          row + 1,
        );
        const continuesEast = isRoutePair(
          col + 2,
          row,
          col + 2,
          row + 1,
        );
        if (
          !continuesNorth ||
          !continuesSouth ||
          !continuesWest ||
          !continuesEast
        ) {
          continue;
        }
        if (
          overpassPlan?.crossing.col === col &&
          overpassPlan.crossing.row === row
        ) {
          continue;
        }
        return { col, row };
      }
    }
    return null;
  }

  static #validateFlatPathCrossings(grid, overpassPlan) {
    const crossing = this.#findUnexpectedFlatPathCrossing(
      grid,
      overpassPlan,
    );
    if (crossing) {
      throw new UnexpectedPathCrossingError(crossing);
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

  static #validateHeightDiscipline(grid, heightmap, tileMeta) {
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        const tile = grid[row][col];
        if (tile !== TileType.PATH && tile !== TileType.ENTRY) {
          continue;
        }
        const metadata = tileMeta[row][col];
        const validOverpassHeight =
          metadata.overpassId &&
          (metadata.shape === TILE_SHAPE.SLOPE
            ? Number.isFinite(metadata.slope?.lowHeight) &&
              Number.isFinite(metadata.slope?.highHeight) &&
              heightmap[row][col] ===
                (metadata.slope.lowHeight + metadata.slope.highHeight) / 2
            : heightmap[row][col] === this.#OVERPASS_ELEVATION ||
              heightmap[row][col] === this.#PATH_HEIGHT);
        const validPathDipHeight =
          metadata.pathDipId &&
          (metadata.shape === TILE_SHAPE.SLOPE
            ? Number.isFinite(metadata.slope?.lowHeight) &&
              Number.isFinite(metadata.slope?.highHeight) &&
              metadata.slope.highHeight - metadata.slope.lowHeight ===
                1 / this.#TERRAIN_BRIDGE_DIP_RAMP_TILES &&
              heightmap[row][col] ===
                (metadata.slope.lowHeight + metadata.slope.highHeight) / 2
            : metadata.shape === TILE_SHAPE.FLAT &&
              heightmap[row][col] ===
                this.#TERRAIN_BRIDGE_DIP_ELEVATION);
        if (
          heightmap[row][col] !== this.#PATH_HEIGHT &&
          !validOverpassHeight &&
          !validPathDipHeight
        ) {
          throw new PathHeightMismatchError();
        }
      }
    }
  }

  static #validateOverpass(grid, heightmap, tileMeta, plan) {
    if (!plan) {
      return;
    }

    const validatePathCells = (cells, expectedHeight, expectedShape) => {
      for (const cell of cells) {
        if (
          !this.#inBounds(cell.col, cell.row) ||
          grid[cell.row][cell.col] !== TileType.PATH ||
          tileMeta[cell.row][cell.col].overpassId !== plan.id ||
          tileMeta[cell.row][cell.col].shape !== expectedShape ||
          heightmap[cell.row][cell.col] !== expectedHeight
        ) {
          throw new InvalidOverpassError({
            reason: `has invalid path terrain at (${cell.col}, ${cell.row})`,
          });
        }
      }
    };

    validatePathCells(plan.crossingCells, plan.baseElevation, TILE_SHAPE.FLAT);
    validatePathCells(
      plan.approachCells,
      plan.deckElevation,
      TILE_SHAPE.FLAT,
    );
    for (const cell of plan.approachCells) {
      if (
        tileMeta[cell.row][cell.col].renderMode !== 'SOLID' ||
        tileMeta[cell.row][cell.col].bridgeGroundHeight !== null
      ) {
        throw new InvalidOverpassError({
          reason: `does not fill its elevated approach at (${cell.col}, ${cell.row})`,
        });
      }
    }
    for (const cell of plan.slopeCells) {
      validatePathCells(
        [cell],
        (cell.lowHeight + cell.highHeight) / 2,
        TILE_SHAPE.SLOPE,
      );
      const slope = tileMeta[cell.row][cell.col].slope;
      if (
        slope.lowHeight !== cell.lowHeight ||
        slope.highHeight !== cell.highHeight ||
        slope.riseDirection !== cell.riseDirection ||
        slope.highHeight - slope.lowHeight !== this.#OVERPASS_HALF_STEP
      ) {
        throw new InvalidOverpassError({
          reason: `has an invalid gentle ramp at (${cell.col}, ${cell.row})`,
        });
      }
    }

    const landingRows = [
      plan.crossing.row - this.#OVERPASS_RAMP_TILES - 2,
      plan.crossing.row + this.#OVERPASS_RAMP_TILES + 3,
    ];
    for (const row of landingRows) {
      for (
        let col = plan.crossing.col;
        col < plan.crossing.col + plan.crossing.width;
        col += 1
      ) {
        if (
          !this.#inBounds(col, row) ||
          grid[row][col] !== TileType.PATH
        ) {
          throw new InvalidOverpassError({
            reason: `narrows below two path tiles at (${col}, ${row})`,
          });
        }
      }
    }

    for (const cell of plan.crossingCells) {
      const overpass = tileMeta[cell.row][cell.col].overpass;
      if (
        overpass?.elevation !== plan.deckElevation ||
        overpass.direction !== plan.upperDirection ||
        tileMeta[cell.row][cell.col].direction !== plan.lowerDirection
      ) {
        throw new InvalidOverpassError({
          reason: `does not preserve two separate routes at (${cell.col}, ${cell.row})`,
        });
      }
    }
  }

  static #validatePathDips(
    grid,
    heightmap,
    tileMeta,
    plans,
    riverData,
  ) {
    const riverCells = new Set(
      riverData.flatMap((river) =>
        river.cells.map((cell) => this.#tileKey(cell.col, cell.row)),
      ),
    );
    const planIds = new Set();
    const plannedCells = new Set();

    for (const plan of plans) {
      if (planIds.has(plan.id)) {
        throw new InvalidPathDipError({
          id: plan.id,
          reason: 'has a duplicate identifier',
        });
      }
      planIds.add(plan.id);
      if (
        plan.rampTiles !== this.#TERRAIN_BRIDGE_DIP_RAMP_TILES ||
        plan.slopeCells.length !== plan.rampTiles * 4 ||
        plan.flatCells.length < 2 ||
        plan.landingCells.length !== 4
      ) {
        throw new InvalidPathDipError({
          id: plan.id,
          reason: 'does not preserve a two-tile-wide descent and landing',
        });
      }

      for (const cell of [...plan.slopeCells, ...plan.flatCells]) {
        const key = this.#tileKey(cell.col, cell.row);
        const metadata = tileMeta[cell.row]?.[cell.col];
        if (
          plannedCells.has(key) ||
          !metadata ||
          grid[cell.row][cell.col] !== TileType.PATH ||
          metadata.pathDipId !== plan.id ||
          metadata.overpassId ||
          riverCells.has(key) ||
          metadata.renderMode !== 'SOLID' ||
          metadata.bridgeGroundHeight !== null
        ) {
          throw new InvalidPathDipError({
            id: plan.id,
            reason: `has invalid terrain at (${cell.col}, ${cell.row})`,
          });
        }
        plannedCells.add(key);
      }

      for (const cell of plan.flatCells) {
        if (
          tileMeta[cell.row][cell.col].shape !== TILE_SHAPE.FLAT ||
          heightmap[cell.row][cell.col] !== plan.elevation
        ) {
          throw new InvalidPathDipError({
            id: plan.id,
            reason: `has an invalid low section at (${cell.col}, ${cell.row})`,
          });
        }
      }

      for (const cell of plan.slopeCells) {
        const metadata = tileMeta[cell.row][cell.col];
        const slope = metadata.slope;
        if (
          metadata.shape !== TILE_SHAPE.SLOPE ||
          heightmap[cell.row][cell.col] !==
            (cell.lowHeight + cell.highHeight) / 2 ||
          slope?.lowHeight !== cell.lowHeight ||
          slope.highHeight !== cell.highHeight ||
          slope.riseDirection !== cell.riseDirection ||
          slope.highHeight - slope.lowHeight !== 1 / plan.rampTiles
        ) {
          throw new InvalidPathDipError({
            id: plan.id,
            reason: `has an invalid ramp at (${cell.col}, ${cell.row})`,
          });
        }
      }

      for (const cell of plan.landingCells) {
        const metadata = tileMeta[cell.row]?.[cell.col];
        if (
          !metadata ||
          grid[cell.row][cell.col] !== TileType.PATH ||
          heightmap[cell.row][cell.col] !== this.#PATH_HEIGHT ||
          metadata.shape !== TILE_SHAPE.FLAT ||
          metadata.direction !== plan.direction ||
          metadata.overpassId ||
          riverCells.has(this.#tileKey(cell.col, cell.row)) ||
          metadata.renderMode !== 'SOLID'
        ) {
          throw new InvalidPathDipError({
            id: plan.id,
            reason: `has an invalid landing at (${cell.col}, ${cell.row})`,
          });
        }
      }
    }

    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        const pathDipId = tileMeta[row][col].pathDipId;
        if (
          pathDipId &&
          (!planIds.has(pathDipId) ||
            !plannedCells.has(this.#tileKey(col, row)))
        ) {
          throw new InvalidPathDipError({
            id: pathDipId,
            reason: `has undeclared terrain at (${col}, ${row})`,
          });
        }
      }
    }
  }

  static #validatePathRenderModes(grid, heightmap, tileMeta) {
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        if (grid[row][col] !== TileType.PATH) {
          continue;
        }
        const expected = this.#classifyRenderMode(
          grid,
          heightmap,
          tileMeta,
          col,
          row,
        );
        const actual = tileMeta[row][col].renderMode;
        if (actual !== expected) {
          throw new PathRenderModeMismatchError({
            col,
            row,
            expected,
            actual,
          });
        }
      }
    }
  }

  static #validateBridgeGroundHeights(
    heightmap,
    tileMeta,
    riverData,
  ) {
    const riverBridgeCells = new Set(
      riverData.flatMap((river) =>
        river.cells
          .filter((cell) => cell.underBridge)
          .map((cell) => this.#tileKey(cell.col, cell.row)),
      ),
    );
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        if (
          tileMeta[row][col].renderMode !== 'BRIDGE' ||
          riverBridgeCells.has(this.#tileKey(col, row))
        ) {
          continue;
        }
        const expectedHeight = Math.max(1, heightmap[row][col] - 1);
        const actualHeight = tileMeta[row][col].bridgeGroundHeight;
        if (actualHeight !== expectedHeight) {
          throw new BridgeGroundHeightMismatchError({
            col,
            row,
            expectedHeight,
            actualHeight,
          });
        }
      }
    }
  }

  static #validateBridgeTurns(tileMeta) {
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        if (tileMeta[row][col].renderMode !== 'BRIDGE') {
          continue;
        }
        const direction = tileMeta[row][col].direction;
        const horizontal =
          direction === this.#DIRECTIONS.EAST ||
          direction === this.#DIRECTIONS.WEST;
        for (const [deltaCol, deltaRow] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const neighborCol = col + deltaCol;
          const neighborRow = row + deltaRow;
          if (
            !this.#inBounds(neighborCol, neighborRow) ||
            tileMeta[neighborRow][neighborCol].renderMode !== 'BRIDGE'
          ) {
            continue;
          }
          const neighborDirection =
            tileMeta[neighborRow][neighborCol].direction;
          const neighborHorizontal =
            neighborDirection === this.#DIRECTIONS.EAST ||
            neighborDirection === this.#DIRECTIONS.WEST;
          if (horizontal !== neighborHorizontal) {
            throw new BridgeTurnError({ col, row });
          }
        }
      }
    }
  }

  static #validateGrassNoise(grid, heightmap, tileMeta, riverData) {
    const intentionalRiverBanks = new Set();
    for (const river of riverData) {
      for (const cell of river.cells) {
        for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
          for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
            intentionalRiverBanks.add(
              this.#tileKey(cell.col + deltaCol, cell.row + deltaRow),
            );
          }
        }
      }
    }

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

        if (
          relatedNeighbors === 0 &&
          !intentionalRiverBanks.has(this.#tileKey(col, row))
        ) {
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

  static #validateNoSingleCellTerrainHoles(grid) {
    for (let row = 1; row < this.#MAP_ROWS - 1; row++) {
      for (let col = 1; col < this.#MAP_COLS - 1; col++) {
        if (grid[row][col] !== TileType.WATER) {
          continue;
        }
        const enclosed = [
          grid[row - 1][col],
          grid[row + 1][col],
          grid[row][col - 1],
          grid[row][col + 1],
        ].every((tile) => tile !== TileType.WATER);
        if (enclosed) {
          throw new IsolatedTerrainHoleError({ col, row });
        }
      }
    }
  }

  static #validateRivers(
    grid,
    heightmap,
    tileMeta,
    islandMask,
    layout,
    riverData,
  ) {
    if (riverData.length > this.#MAX_RIVERS) {
      throw new InvalidRiverCountError({
        count: riverData.length,
        maximum: this.#MAX_RIVERS,
      });
    }
    const lavaRiverCount = riverData.filter(
      (river) => river.kind === RIVER_KIND.LAVA,
    ).length;
    if (
      lavaRiverCount > this.#MAX_LAVA_ELIGIBLE_RIVERS ||
      (riverData.length > this.#MAX_LAVA_ELIGIBLE_RIVERS &&
        lavaRiverCount > 0)
    ) {
      throw new InvalidLavaRiverCountError({
        lavaCount: lavaRiverCount,
        riverCount: riverData.length,
        maximum: this.#MAX_LAVA_ELIGIBLE_RIVERS,
      });
    }

    const occupied = new Set();
    const allRiverCells = new Set(
      riverData.flatMap((river) =>
        river.cells.map((cell) => this.#tileKey(cell.col, cell.row)),
      ),
    );
    const directionOffsets = {
      [this.#DIRECTIONS.NORTH]: [0, -1],
      [this.#DIRECTIONS.EAST]: [1, 0],
      [this.#DIRECTIONS.SOUTH]: [0, 1],
      [this.#DIRECTIONS.WEST]: [-1, 0],
    };
    for (const river of riverData) {
      const riverCells = new Set();
      if (
        river.cells.length < this.#MIN_RIVER_TILES ||
        river.upstreamLength < 5
      ) {
        throw new InvalidRiverPathError({
          riverId: river.id,
          reason: 'does not provide five inland flow tiles before its waterfall',
        });
      }
      if (
        river.source.terrainHeight < 2 ||
        !this.#hasRiverSourceSetback(
          islandMask,
          river.source.col,
          river.source.row,
        )
      ) {
        throw new InvalidRiverPathError({
          riverId: river.id,
          reason: 'does not begin on elevated terrain at least five tiles inland',
        });
      }

      const source = river.cells[0];
      const requiredSourceBankHeight = Math.ceil(
        source.elevation + this.#riverSurfaceInset(river),
      );
      const riverCellKeys = new Set(
        river.cells.map((cell) => this.#tileKey(cell.col, cell.row)),
      );
      for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
        for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
          if (deltaCol === 0 && deltaRow === 0) {
            continue;
          }
          const bankCol = source.col + deltaCol;
          const bankRow = source.row + deltaRow;
          if (riverCellKeys.has(this.#tileKey(bankCol, bankRow))) {
            continue;
          }
          if (
            !this.#inBounds(bankCol, bankRow) ||
            grid[bankRow][bankCol] !== TileType.GRASS ||
            heightmap[bankRow][bankCol] < requiredSourceBankHeight
          ) {
            throw new InvalidRiverFlowError({
              riverId: river.id,
              reason: 'does not have a complete raised-earth source enclosure',
            });
          }
        }
      }

      for (let index = 0; index < river.cells.length; index++) {
        const cell = river.cells[index];
        const key = this.#tileKey(cell.col, cell.row);
        if (riverCells.has(key)) {
          throw new InvalidRiverPathError({
            riverId: river.id,
            reason: `reuses its own flow tile at (${cell.col}, ${cell.row})`,
          });
        }
        if (this.#touchesOccupiedRiver(occupied, cell.col, cell.row)) {
          throw new InvalidRiverPathError({
            riverId: river.id,
            reason: `does not leave an earth-cell buffer around (${cell.col}, ${cell.row})`,
          });
        }
        riverCells.add(key);

        if (cell.underBridge) {
          if (
            grid[cell.row][cell.col] !== TileType.PATH ||
            tileMeta[cell.row][cell.col].renderMode !== 'BRIDGE'
          ) {
            throw new InvalidRiverPathError({
              riverId: river.id,
              reason: `crosses a path without a bridge at (${cell.col}, ${cell.row})`,
            });
          }
        } else if (
          grid[cell.row][cell.col] !== TileType.WATER ||
          tileMeta[cell.row][cell.col].surfaceType !== 'WATER'
        ) {
          throw new InvalidRiverPathError({
            riverId: river.id,
            reason: `contains a non-water flow tile at (${cell.col}, ${cell.row})`,
          });
        }

        if (!cell.underBridge) {
          const [flowCol, flowRow] =
            directionOffsets[cell.direction] ?? [0, 0];
          const crossCol = -flowRow;
          const crossRow = flowCol;
          const requiredBankHeight = Math.ceil(
            cell.elevation + this.#riverSurfaceInset(river),
          );
          for (const side of [-1, 1]) {
            const bankCol = cell.col + crossCol * side;
            const bankRow = cell.row + crossRow * side;
            if (
              !this.#inBounds(bankCol, bankRow) ||
              allRiverCells.has(this.#tileKey(bankCol, bankRow))
            ) {
              continue;
            }
            const bankTile = grid[bankRow][bankCol];
            if (bankTile !== TileType.GRASS) {
              if (bankTile !== TileType.WATER) {
                continue;
              }
              throw new InvalidRiverFlowError({
                riverId: river.id,
                reason: `has a missing earth bank at (${bankCol}, ${bankRow})`,
              });
            }
            if (heightmap[bankRow][bankCol] < requiredBankHeight) {
              throw new InvalidRiverFlowError({
                riverId: river.id,
                reason: `has a low earth bank at (${bankCol}, ${bankRow})`,
              });
            }
          }
        }

        if (index === river.cells.length - 1) {
          continue;
        }
        const next = river.cells[index + 1];
        if (
          this.#directionFromStep(cell, next) !== cell.direction ||
          next.elevation > cell.elevation
        ) {
          throw new InvalidRiverFlowError({
            riverId: river.id,
            reason: `flows uphill or loses direction at (${cell.col}, ${cell.row})`,
          });
        }
      }

      for (const key of riverCells) {
        occupied.add(key);
      }

      for (const cascade of river.cascades) {
        const [deltaCol, deltaRow] =
          directionOffsets[cascade.direction] ?? [0, 0];
        const crossCol = -deltaRow;
        const crossRow = deltaCol;
        const requiredBankHeight = Math.ceil(cascade.topElevation);
        for (const anchor of [cascade.from, cascade.to]) {
          for (const side of [-1, 1]) {
            const bankCol = anchor.col + crossCol * side;
            const bankRow = anchor.row + crossRow * side;
            if (
              !this.#inBounds(bankCol, bankRow) ||
              grid[bankRow][bankCol] !== TileType.GRASS
            ) {
              continue;
            }
            if (heightmap[bankRow][bankCol] < requiredBankHeight) {
              throw new InvalidRiverFlowError({
                riverId: river.id,
                reason: `exposes the side of a cascade at (${bankCol}, ${bankRow})`,
              });
            }
          }
        }
      }

      const terminal = river.cells[river.cells.length - 1];
      const waterfall = river.waterfall;
      const [deltaCol, deltaRow] = directionOffsets[waterfall.direction] ?? [0, 0];
      const outsideCol = terminal.col + deltaCol;
      const outsideRow = terminal.row + deltaRow;
      if (
        terminal.direction !== waterfall.direction ||
        waterfall.col !== terminal.col ||
        waterfall.row !== terminal.row ||
        waterfall.bottomElevation >= waterfall.topElevation ||
        (this.#inBounds(outsideCol, outsideRow) &&
          islandMask[outsideRow][outsideCol]) ||
        this.#isNearGate(layout, terminal.col, terminal.row) ||
        this.#isNearCastleForRiver(layout, terminal.col, terminal.row)
      ) {
        throw new InvalidRiverFlowError({
          riverId: river.id,
          reason: 'does not end in a clear, outward-facing edge waterfall',
        });
      }

      const crossCol = -deltaRow;
      const crossRow = deltaCol;
      const requiredShoulderHeight = Math.ceil(
        terminal.elevation + this.#riverSurfaceInset(river),
      );
      for (const side of [-1, 1]) {
        const shoulderCol = outsideCol + crossCol * side;
        const shoulderRow = outsideRow + crossRow * side;
        if (!this.#inBounds(shoulderCol, shoulderRow)) {
          throw new InvalidRiverFlowError({
            riverId: river.id,
            reason: `places a waterfall shoulder outside the map at (${shoulderCol}, ${shoulderRow})`,
          });
        }
        if (allRiverCells.has(this.#tileKey(shoulderCol, shoulderRow))) {
          continue;
        }
        const shoulderTile = grid[shoulderRow][shoulderCol];
        if (shoulderTile === TileType.WATER) {
          throw new InvalidRiverFlowError({
            riverId: river.id,
            reason: `has a missing waterfall shoulder at (${shoulderCol}, ${shoulderRow})`,
          });
        }
        if (
          shoulderTile === TileType.GRASS &&
          heightmap[shoulderRow][shoulderCol] < requiredShoulderHeight
        ) {
          throw new InvalidRiverFlowError({
            riverId: river.id,
            reason: `has a low waterfall shoulder at (${shoulderCol}, ${shoulderRow})`,
          });
        }
      }
    }
  }

  static #validateMap(
    grid,
    heightmap,
    tileMeta,
    layout,
    islandMask,
    vegetationData,
    groundCoverData,
    riverData,
    routeCellsByPath,
  ) {
    this.#validateRivers(
      grid,
      heightmap,
      tileMeta,
      islandMask,
      layout,
      riverData,
    );
    this.#validateNoSingleCellTerrainHoles(grid);
    this.#validateIslandConnectivity(grid);
    this.#validateGatePlacement(grid, layout);
    this.#validatePathSpacing(layout);
    this.#validateRouteSeparation(routeCellsByPath, layout);
    this.#validateParallelPathClearance(grid, layout);
    this.#validateFlatPathCrossings(grid, layout.overpassPlan);
    this.#validateRouteReachability(grid, layout);
    this.#validateCastleEntrance(grid, layout);
    this.#validateCastleGroundClearance(grid, layout);
    this.#validateHeightDiscipline(grid, heightmap, tileMeta);
    this.#validateOverpass(
      grid,
      heightmap,
      tileMeta,
      layout.overpassPlan,
    );
    this.#validatePathRenderModes(grid, heightmap, tileMeta);
    this.#validatePathDips(
      grid,
      heightmap,
      tileMeta,
      layout.pathDipPlans,
      riverData,
    );
    this.#validateBridgeTurns(tileMeta);
    this.#validateBridgeGroundHeights(heightmap, tileMeta, riverData);
    this.#validateGrassNoise(grid, heightmap, tileMeta, riverData);
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
