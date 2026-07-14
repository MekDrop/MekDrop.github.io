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
  static #CASTLE_WIDTH = 7;
  static #CASTLE_HALF_HEIGHT = 3;
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
    const { numPaths } = this.#normalizeOptions(options);
    const layout = this.#createLayoutConfig(numPaths);
    const grid = this.#createGrid(TileType.WATER);
    const tileMeta = this.#createTileMetadata();
    const islandMask = this.#buildIslandMask(layout);

    this.#materializeIsland(grid, tileMeta, islandMask);
    const { mergeZones, routeCellsByPath, trunkStart } = this.#carvePaths(grid, tileMeta, layout);
    this.#placeCastle(grid, tileMeta, layout);

    const heightmap = this.#buildHeightmap(grid, layout);
    this.#applyHeightsToMetadata(grid, tileMeta, heightmap);
    this.#validateMap(grid, heightmap, layout);

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
      numPaths: layout.entries.length,
      paths: routeCellsByPath,
      arrowData: this.#buildArrowData(layout),
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
    const castleLeft = this.#rng(24, 31);
    const anchorRows = this.#ENTRY_TEMPLATES.map(template => [...template.gateRows]);
    const pathRows = anchorRows[this.#rng(0, anchorRows.length - 1)];
    const castleCenterRow = pathRows[1];
    const castleTop = castleCenterRow - this.#CASTLE_HALF_HEIGHT;
    const castleBottom = castleCenterRow + this.#CASTLE_HALF_HEIGHT;
    const castleRight = castleLeft + this.#CASTLE_WIDTH - 1;
    const castleEntranceRows = [...pathRows];
    const entries = this.#selectEntries(numPaths, castleLeft, castleTop, castleBottom);
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
      castleEntranceCol: castleLeft,
      pathRows,
      castleEntranceRows,
      entries,
      islandEllipses,
      hillEllipses,
      signature: JSON.stringify({
        castleLeft,
        castleCenterRow,
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
    this.#fillMaskRect(mask, layout.castleLeft - 2, layout.castleTop - 2, layout.castleRight + 2, layout.castleBottom + 2);

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

  static #selectEntries(numPaths, castleLeft, castleTop, castleBottom) {
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
      return {
        ...template,
        side,
        gateCol: side === 'LEFT' ? this.#LEFT_GATE_COL : this.#RIGHT_GATE_COL,
        inwardDirection: side === 'LEFT' ? this.#DIRECTIONS.EAST : this.#DIRECTIONS.WEST,
        mergeCol,
      };
    });
  }

  static #drawHorizontalPath(grid, tileMeta, startCol, endCol, rows, direction, type = TileType.PATH) {
    const left = Math.min(startCol, endCol);
    const right = Math.max(startCol, endCol);

    for (const row of rows) {
      this.#fillRect(grid, tileMeta, left, row, right, row, type, {
        surfaceType: type === TileType.ENTRY ? 'STRUCTURE' : 'PATH',
        baseHeight: this.#PATH_HEIGHT,
        direction,
      });
    }
  }

  static #drawVerticalPath(grid, tileMeta, colLeft, top, bottom) {
    this.#fillRect(grid, tileMeta, colLeft, top, colLeft + 1, bottom, TileType.PATH, {
      surfaceType: 'PATH',
      baseHeight: this.#PATH_HEIGHT,
      direction: top <= bottom ? this.#DIRECTIONS.SOUTH : this.#DIRECTIONS.NORTH,
    });
  }

  static #addHorizontalRoute(grid, tileMeta, cells, startCol, endCol, rows, direction) {
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
    for (let row = top; row <= bottom; row++) {
      cells.add(this.#tileKey(colLeft, row));
      cells.add(this.#tileKey(colLeft + 1, row));
    }
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

      const horizontalStart = entry.inwardDirection === this.#DIRECTIONS.EAST ? entry.gateCol + 1 : entry.gateCol - 1;
      const horizontalEnd = entry.inwardDirection === this.#DIRECTIONS.EAST ? entry.mergeCol + 1 : entry.mergeCol;
      this.#addHorizontalRoute(grid, tileMeta, cells, horizontalStart, horizontalEnd, entry.gateRows, entry.inwardDirection);

      if (bottomRow < layout.pathRows[0]) {
        this.#addVerticalRoute(grid, tileMeta, cells, entry.mergeCol, topRow, layout.pathRows[1]);
      } else if (topRow > layout.pathRows[1]) {
        this.#addVerticalRoute(grid, tileMeta, cells, entry.mergeCol, layout.pathRows[0], bottomRow);
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

  static #buildArrowData(layout) {
    const arrowData = new Map();

    layout.entries.forEach((entry, pathIdx) => {
      const row = entry.gateRows[0];
      const key = `${entry.gateCol},${row}`;
      arrowData.set(key, [{
        dc: entry.inwardDirection === this.#DIRECTIONS.WEST ? -1 : 1,
        dr: 0,
        sideDc: 0,
        sideDr: 1,
        marker: 'arrow',
        pathIdx,
      }]);
    });

    return arrowData;
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
      throw new Error('Map validation failed: island has no playable terrain.');
    }

    const seen = this.#findConnectedComponent(grid, [allLand[0]]);
    if (seen.size !== allLand.length) {
      throw new Error('Map validation failed: playable terrain is not one connected island.');
    }
  }

  static #validateGatePlacement(grid, layout) {
    for (const entry of layout.entries) {
      const outsideCol = entry.inwardDirection === this.#DIRECTIONS.WEST ? entry.gateCol + 1 : entry.gateCol - 1;
      const insideCol = entry.inwardDirection === this.#DIRECTIONS.WEST ? entry.gateCol - 1 : entry.gateCol + 1;

      for (const row of entry.gateRows) {
        if (grid[row][entry.gateCol] !== TileType.ENTRY) {
          throw new Error('Map validation failed: gate is not placed on the first boundary path tiles.');
        }
        if (this.#inBounds(outsideCol, row) && grid[row][outsideCol] !== TileType.WATER) {
          throw new Error('Map validation failed: normal path tiles appear outside a gate.');
        }
        if (!this.#inBounds(insideCol, row) || grid[row][insideCol] !== TileType.PATH) {
          throw new Error('Map validation failed: gate does not connect to a valid path.');
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
          throw new Error('Map validation failed: parallel paths are separated by fewer than two full grass tiles.');
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
          throw new Error('Map validation failed: two parallel paths are separated by fewer than two full grass tiles outside a merge zone.');
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
          throw new Error('Map validation failed: two parallel paths are separated by fewer than two full grass tiles outside a merge zone.');
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
        throw new Error('Map validation failed: an entry path does not reach the castle.');
      }
    }
  }

  static #validateCastleEntrance(grid, layout) {
    for (const row of layout.castleEntranceRows) {
      if (grid[row][layout.castleEntranceCol] !== TileType.PATH) {
        throw new Error('Map validation failed: the final path does not end at the castle entrance.');
      }
    }
  }

  static #validateHeightDiscipline(grid, heightmap) {
    for (let row = 0; row < this.#MAP_ROWS; row++) {
      for (let col = 0; col < this.#MAP_COLS; col++) {
        const tile = grid[row][col];
        if ((tile === TileType.PATH || tile === TileType.ENTRY) && heightmap[row][col] !== this.#PATH_HEIGHT) {
          throw new Error('Map validation failed: paired path lanes differ in height or slope.');
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
          throw new Error('Map validation failed: grass elevation changes appear as random isolated noise.');
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
      throw new Error('Map validation failed: regeneration always keeps the same island shape or castle position.');
    }
  }

  static #validateMap(grid, heightmap, layout) {
    this.#validateIslandConnectivity(grid);
    this.#validateGatePlacement(grid, layout);
    this.#validatePathSpacing(layout);
    this.#validateParallelPathClearance(grid, layout);
    this.#validateRouteReachability(grid, layout);
    this.#validateCastleEntrance(grid, layout);
    this.#validateHeightDiscipline(grid, heightmap);
    this.#validateGrassNoise(grid, heightmap);
    this.#validateLayoutVariety(layout);
  }
}

export function generateMap(options) {
  return MapGenerator.generate(options);
}




