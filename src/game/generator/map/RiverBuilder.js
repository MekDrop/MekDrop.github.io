import {
  RIVER_KIND,
} from "../../enum/RiverKind.js";
import {
  TILE_SHAPE,
} from "../../enum/TileShape.js";
import {
  MAP_COLS,
  MAP_ROWS,
  PATH_HEIGHT,
  MAX_RIVERS,
  RIVER_SURFACE_INSET,
  LAVA_SURFACE_INSET,
  RIVER_WATER_DEPTH,
  BRIDGE_WATER_CLEARANCE,
  TERMINAL_WATERFALL_BOTTOM,
  RIVER_COUNT_WEIGHTS,
  LAVA_ISLAND_CHANCE,
  MAX_LAVA_ELIGIBLE_RIVERS,
} from "./mapGenerationConfig.js";
import {
  MAP_DIRECTION as DIRECTIONS,
} from "../../enum/MapDirection.js";
import {
  MAP_TILE_TYPE as TileType,
} from "../../enum/MapTileType.js";
import {
  MapGrid,
} from "./MapGrid.js";
import {
  RiverPlacementRules,
} from "./RiverPlacementRules.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").MapCell} MapCell
 * @typedef {import("./MapGenerationTypes.js").RiverRecord} RiverRecord
 * @typedef {import("./MapGenerationTypes.js").GenerationYieldState} GenerationYieldState
 * @typedef {import("./MapGenerationTypes.js").RiverData} RiverData
 */

/**
 * Chooses river counts and kinds, materializes channels and waterfalls, and raises their earth banks.
 */
export class RiverBuilder {
  /**
   * @type {import("./GenerationRandom.js").GenerationRandom}
   */
  #random;

  /**
   * @type {import("./RiverRouter.js").RiverRouter}
   */
  #router;

  /**
   * @type {(state: import("./MapGenerationTypes.js").GenerationYieldState) => Promise<void>}
   */
  #yieldIfNeeded;

  /**
   * @param {import("./GenerationRandom.js").GenerationRandom} random
   * @param {import("./RiverRouter.js").RiverRouter} router
   * @param {(state: import("./MapGenerationTypes.js").GenerationYieldState) => Promise<void>} yieldIfNeeded
   */
  constructor(random, router, yieldIfNeeded) {
    this.#random = random;
    this.#router = router;
    this.#yieldIfNeeded = yieldIfNeeded;
  }

  /**
   * @param {number} requestedNumRivers
   */
  #selectRiverCount(requestedNumRivers) {
    if (Number.isFinite(requestedNumRivers)) {
      return MapGrid.clamp(Math.round(requestedNumRivers), 0, MAX_RIVERS);
    }

    const roll = this.#random.rng(1, 100);
    let cumulativeWeight = 0;
    for (let count = 0; count < RIVER_COUNT_WEIGHTS.length; count++) {
      cumulativeWeight += RIVER_COUNT_WEIGHTS[count];
      if (roll <= cumulativeWeight) {
        return count;
      }
    }
    return MAX_RIVERS;
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {MapCell[]} route
   * @param {string} terminalDirection
   * @param {number} riverIndex
   */
  #materializeRiver(
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
      RIVER_WATER_DEPTH,
      heightmap[route[0].row][route[0].col] - RIVER_SURFACE_INSET,
    );

    for (let index = 0; index < route.length; index++) {
      const cell = route[index];
      const tile = grid[cell.row][cell.col];
      const underBridge = tile === TileType.PATH;
      const terrainHeight = heightmap[cell.row][cell.col];
      const heightLimit = underBridge
        ? PATH_HEIGHT - BRIDGE_WATER_CLEARANCE
        : Math.max(
            RIVER_WATER_DEPTH,
            terrainHeight - RIVER_SURFACE_INSET,
          );
      const previousElevation = waterElevation;
      waterElevation = Math.min(waterElevation, heightLimit);
      const direction =
        index < route.length - 1
          ? MapGrid.directionFromStep(cell, route[index + 1])
          : terminalDirection;

      cells.push({
        ...cell,
        direction,
        elevation: waterElevation,
        bedElevation: Math.max(0, waterElevation - RIVER_WATER_DEPTH),
        terrainHeight,
        underBridge,
      });

      if (index > 0 && previousElevation - waterElevation > 0.04) {
        cascades.push({
          from: { ...route[index - 1] },
          to: { ...cell },
          direction: MapGrid.directionFromStep(route[index - 1], cell),
          topElevation: previousElevation,
          bottomElevation: waterElevation,
        });
      }

      if (!underBridge) {
        MapGrid.setTile(grid, tileMeta, cell.col, cell.row, TileType.WATER, {
          surfaceType: "WATER",
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
          TERMINAL_WATERFALL_BOTTOM,
          terminal.elevation - 11.5,
        ),
      },
    };
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {MapLayout} layout
   * @param {boolean[][]} islandMask
   * @param {number} requestedNumRivers
   * @param {GenerationYieldState} yieldState
   */
  async generateRivers(
    grid,
    heightmap,
    tileMeta,
    layout,
    islandMask,
    requestedNumRivers,
    yieldState,
  ) {
    const riverCount = this.#selectRiverCount(requestedNumRivers);
    if (riverCount === 0) {
      return [];
    }

    const sourceCandidates = [];
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (
          grid[row][col] === TileType.GRASS &&
          !tileMeta[row][col].overpassPlateauId &&
          heightmap[row][col] >= 2 &&
          RiverPlacementRules.hasRiverSourceSetback(islandMask, col, row) &&
          !RiverPlacementRules.isNearCastleForRiver(layout, col, row)
        ) {
          sourceCandidates.push({ col, row, height: heightmap[row][col] });
        }
      }
    }
    this.#random.shuffle(sourceCandidates);
    sourceCandidates.sort(/**
     *
     * @param {{height: number}} left
     * @param {{height: number}} right
     */
    (left, right) => right.height - left.height);

    const rivers = [];
    const occupiedRiverCells = new Set();
    for (const source of sourceCandidates) {
      await this.#yieldIfNeeded(yieldState);
      if (rivers.length >= riverCount) {
        break;
      }
      if (
        RiverPlacementRules.touchesOccupiedRiver(occupiedRiverCells, source.col, source.row)
      ) {
        continue;
      }
      const result = await this.#router.findRiverRoute(
        grid,
        tileMeta,
        islandMask,
        layout,
        source,
        occupiedRiverCells,
        yieldState,
      );
      if (!result) {
        continue;
      }
      if (!this.#router.riverSourceHasEarthEnclosure(grid, result.route)) {
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
        occupiedRiverCells.add(MapGrid.tileKey(cell.col, cell.row));
      }
    }
    return rivers;
  }

  /**
   * @param {RiverData[]} rivers
   */
  assignRiverKinds(rivers) {
    if (
      rivers.length === 0 ||
      rivers.length > MAX_LAVA_ELIGIBLE_RIVERS ||
      this.#random.rng(1, LAVA_ISLAND_CHANCE) !== 1
    ) {
      return;
    }

    const lavaRiverCount = this.#random.rng(
      1,
      Math.min(MAX_LAVA_ELIGIBLE_RIVERS, rivers.length),
    );
    for (const river of this.#random.shuffle([...rivers]).slice(0, lavaRiverCount)) {
      river.kind = RIVER_KIND.LAVA;
    }
  }

  /**
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {RiverData[]} rivers
   */
  raiseLavaSurfaces(heightmap, tileMeta, rivers) {
    for (const river of rivers) {
      if (river.kind !== RIVER_KIND.LAVA) {
        continue;
      }

      let previousElevation = Number.POSITIVE_INFINITY;
      const cascades = [];
      for (const [index, cell] of river.cells.entries()) {
        const heightLimit = cell.underBridge
          ? PATH_HEIGHT - BRIDGE_WATER_CLEARANCE
          : Math.max(
              RIVER_WATER_DEPTH,
              cell.terrainHeight - LAVA_SURFACE_INSET,
            );
        const elevation = Math.min(previousElevation, heightLimit);
        cell.elevation = elevation;
        cell.bedElevation = Math.max(0, elevation - RIVER_WATER_DEPTH);

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
            direction: MapGrid.directionFromStep(previous, cell),
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

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {boolean[][]} islandMask
   * @param {RiverData[]} riverData
   */
  materializeRiverBanks(
    grid,
    heightmap,
    tileMeta,
    islandMask,
    riverData,
  ) {
    const directionOffsets = {
      [DIRECTIONS.NORTH]: [0, -1],
      [DIRECTIONS.EAST]: [1, 0],
      [DIRECTIONS.SOUTH]: [0, 1],
      [DIRECTIONS.WEST]: [-1, 0],
    };
    const riverCellKeys = new Set(
      riverData.flatMap(/**
       *
       * @param {RiverRecord} river
       */
      (river) =>
        river.cells.map(/**
         *
         * @param {MapCell} cell
         */
        (cell) => MapGrid.tileKey(cell.col, cell.row)),
      ),
    );

    for (const river of riverData) {
      for (const cell of river.cells) {
        if (cell.underBridge) {
          continue;
        }
        const [deltaCol, deltaRow] = directionOffsets[cell.direction] ?? [0, 0];
        const crossCol = -deltaRow;
        const crossRow = deltaCol;
        const bankHeight = Math.ceil(
          cell.elevation + RiverPlacementRules.riverSurfaceInset(river),
        );

        for (const side of [-1, 1]) {
          const col = cell.col + crossCol * side;
          const row = cell.row + crossRow * side;
          const key = MapGrid.tileKey(col, row);
          if (
            !MapGrid.inBounds(col, row) ||
            riverCellKeys.has(key) ||
            (grid[row][col] !== TileType.GRASS &&
              grid[row][col] !== TileType.WATER)
          ) {
            continue;
          }
          if (grid[row][col] === TileType.WATER) {
            MapGrid.setTile(grid, tileMeta, col, row, TileType.GRASS, {
              surfaceType: "GRASS",
              baseHeight: bankHeight,
              shape: TILE_SHAPE.FLAT,
              direction: DIRECTIONS.NONE,
            });
          }
          islandMask[row][col] = true;
          heightmap[row][col] = Math.max(heightmap[row][col], bankHeight);
        }
      }

      const terminal = river.cells.at(-1);
      const [waterfallCol, waterfallRow] = directionOffsets[
        river.waterfall.direction
      ] ?? [0, 0];
      const waterfallCrossCol = -waterfallRow;
      const waterfallCrossRow = waterfallCol;
      const waterfallBankHeight = Math.ceil(
        terminal.elevation + RiverPlacementRules.riverSurfaceInset(river),
      );
      for (const side of [-1, 1]) {
        const col = terminal.col + waterfallCol + waterfallCrossCol * side;
        const row = terminal.row + waterfallRow + waterfallCrossRow * side;
        const key = MapGrid.tileKey(col, row);
        if (
          !MapGrid.inBounds(col, row) ||
          riverCellKeys.has(key) ||
          (grid[row][col] !== TileType.GRASS &&
            grid[row][col] !== TileType.WATER)
        ) {
          continue;
        }
        if (grid[row][col] === TileType.WATER) {
          MapGrid.setTile(grid, tileMeta, col, row, TileType.GRASS, {
            surfaceType: "GRASS",
            baseHeight: waterfallBankHeight,
            shape: TILE_SHAPE.FLAT,
            direction: DIRECTIONS.NONE,
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
        source.elevation + RiverPlacementRules.riverSurfaceInset(river),
      );
      for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
        for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
          if (deltaCol === 0 && deltaRow === 0) {
            continue;
          }
          const bankCol = source.col + deltaCol;
          const bankRow = source.row + deltaRow;
          const bankKey = MapGrid.tileKey(bankCol, bankRow);
          if (
            !MapGrid.inBounds(bankCol, bankRow) ||
            riverCellKeys.has(bankKey) ||
            (grid[bankRow][bankCol] !== TileType.GRASS &&
              grid[bankRow][bankCol] !== TileType.WATER)
          ) {
            continue;
          }
          if (grid[bankRow][bankCol] === TileType.WATER) {
            MapGrid.setTile(grid, tileMeta, bankCol, bankRow, TileType.GRASS, {
              surfaceType: "GRASS",
              baseHeight: sourceBankHeight,
              shape: TILE_SHAPE.FLAT,
              direction: DIRECTIONS.NONE,
            });
          }
          islandMask[bankRow][bankCol] = true;
          heightmap[bankRow][bankCol] = Math.max(
            heightmap[bankRow][bankCol],
            sourceBankHeight,
          );
        }
      }

      for (const cascade of river.cascades) {
        const [deltaCol, deltaRow] = directionOffsets[cascade.direction] ?? [
          0, 0,
        ];
        const crossCol = -deltaRow;
        const crossRow = deltaCol;
        const bankHeight = Math.ceil(cascade.topElevation);
        for (const anchor of [cascade.from, cascade.to]) {
          for (const side of [-1, 1]) {
            const col = anchor.col + crossCol * side;
            const row = anchor.row + crossRow * side;
            if (
              !MapGrid.inBounds(col, row) ||
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
}
