import {
  InvalidOverpassError,
} from "../../errors/map/index.js";
import {
  TILE_SHAPE,
} from "../../enum/TileShape.js";
import {
  MAP_COLS,
  MAP_ROWS,
  PATH_HEIGHT,
  FOUNDATION_HEIGHT,
  WATER_HEIGHT,
  CASTLE_REAR_GROUND_CLEARANCE,
  OVERPASS_MIN_CLEARANCE,
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
  PathSurfaceRules,
} from "./PathSurfaceRules.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").MapCell} MapCell
 * @typedef {import("./MapGenerationTypes.js").OverpassPlan} OverpassPlan
 * @typedef {import("./MapGenerationTypes.js").RiverRecord} RiverRecord
 * @typedef {import("./MapGenerationTypes.js").RiverData} RiverData
 * @typedef {import("./MapGenerationTypes.js").PathDipPlan} PathDipPlan
 */

/**
 * Builds terrain elevations, overpass fill, lateral supports, and bridge ground metadata.
 */
export class TerrainBuilder {
  /**
   * @param {number} col
   * @param {number[]} row
   * @param {number} centerCol
   * @param {number} centerRow
   * @param {number} radiusX
   * @param {number} radiusY
   */
  #insideEllipse(col, row, centerCol, centerRow, radiusX, radiusY) {
    const dx = (col - centerCol) / radiusX;
    const dy = (row - centerRow) / radiusY;
    return dx * dx + dy * dy <= 1;
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {number} left
   * @param {number} top
   * @param {number} right
   * @param {number} bottom
   * @param {number} value
   * @param {(value: number, col: number, row: number) => boolean} predicate
   */
  #fillHeightRect(
    grid,
    heightmap,
    left,
    top,
    right,
    bottom,
    value,
    predicate = () => true,
  ) {
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        if (!MapGrid.inBounds(col, row)) { continue; }
        if (heightmap[row][col] === WATER_HEIGHT) { continue; }
        if (!predicate(grid[row][col], col, row)) { continue; }
        heightmap[row][col] = value;
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   */
  #blendGrassNearPaths(grid, heightmap) {
    for (let row = 1; row < MAP_ROWS - 1; row++) {
      for (let col = 1; col < MAP_COLS - 1; col++) {
        if (grid[row][col] !== TileType.GRASS) { continue; }

        let touchesPath = false;
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const tile = grid[row + dr][col + dc];
          if (tile === TileType.PATH || tile === TileType.ENTRY) {
            touchesPath = true;
            break;
          }
        }

        if (touchesPath) {
          heightmap[row][col] = PATH_HEIGHT;
        }
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {MapLayout} layout
   */
  #flattenBuildableZones(grid, heightmap, layout) {
    const topPadRight = MapGrid.clamp(layout.castleLeft - 10, 10, 15);
    this.#fillHeightRect(
      grid,
      heightmap,
      6,
      2,
      topPadRight,
      8,
      1,
      /**
       *
       * @param {number} tile
       */
      (tile) => tile === TileType.GRASS,
    );
    this.#fillHeightRect(
      grid,
      heightmap,
      6,
      27,
      12,
      33,
      1,
      /**
       *
       * @param {number} tile
       */
      (tile) => tile === TileType.GRASS,
    );
    this.#fillHeightRect(
      grid,
      heightmap,
      18,
      23,
      24,
      29,
      2,
      /**
       *
       * @param {number} tile
       */
      (tile) => tile === TileType.GRASS,
    );
    this.#fillHeightRect(
      grid,
      heightmap,
      layout.castleLeft - 2,
      layout.castleTop - 1,
      layout.castleRight + CASTLE_REAR_GROUND_CLEARANCE,
      layout.castleBottom + 1,
      FOUNDATION_HEIGHT,
      /**
       *
       * @param {number} tile
       */
      (tile) =>
        tile !== TileType.WATER &&
        tile !== TileType.PATH &&
        tile !== TileType.ENTRY,
    );
    this.#fillHeightRect(
      grid,
      heightmap,
      10,
      layout.pathRows[0],
      layout.castleEntranceCol,
      layout.pathRows[1],
      PATH_HEIGHT,
      /**
       *
       * @param {number} tile
       */
      (tile) => tile === TileType.PATH || tile === TileType.ENTRY,
    );
  }

  /**
   * @param {number[][]} grid
   * @param {MapLayout} layout
   */
  buildHeightmap(grid, layout) {
    const heightmap = MapGrid.createGrid(WATER_HEIGHT);

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = grid[row][col];
        if (tile === TileType.WATER) { continue; }
        if (tile === TileType.PATH || tile === TileType.ENTRY) {
          heightmap[row][col] = PATH_HEIGHT;
          continue;
        }
        if (tile === TileType.CASTLE_WALL || tile === TileType.CASTLE_TOWER) {
          heightmap[row][col] = FOUNDATION_HEIGHT;
          continue;
        }

        let height = 1;
        for (const hill of layout.hillEllipses) {
          if (
            this.#insideEllipse(
              col,
              row,
              hill.centerCol,
              hill.centerRow,
              hill.radiusX,
              hill.radiusY,
            )
          ) {
            height = Math.max(height, hill.height);
          }
        }
        heightmap[row][col] = height;
      }
    }

    this.smoothGrassHeights(grid, heightmap);
    this.#blendGrassNearPaths(grid, heightmap);
    this.#flattenBuildableZones(grid, heightmap, layout);
    return heightmap;
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {OverpassPlan|PathDipPlan} plan
   */
  applyOverpassTerrain(grid, heightmap, tileMeta, plan) {
    if (!plan) {
      return;
    }

    for (const cell of plan.raisedTerrainCells ?? []) {
      if (grid[cell.row][cell.col] !== TileType.GRASS) {
        continue;
      }
      heightmap[cell.row][cell.col] = plan.deckElevation;
      tileMeta[cell.row][cell.col] = {
        ...tileMeta[cell.row][cell.col],
        baseHeight: plan.deckElevation,
        overpassPlateauId: plan.id,
      };
    }

    for (const cell of plan.raisedApproachCells ?? []) {
      heightmap[cell.row][cell.col] = plan.deckElevation;
      tileMeta[cell.row][cell.col] = {
        ...tileMeta[cell.row][cell.col],
        baseHeight: plan.deckElevation,
        shape: TILE_SHAPE.FLAT,
        overpassId: plan.id,
      };
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

    if (plan.clearance < OVERPASS_MIN_CLEARANCE) {
      throw new InvalidOverpassError({
        reason: `provides only ${plan.clearance} blocks of underside clearance`,
      });
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   */
  smoothGrassHeights(grid, heightmap) {
    let changed = true;

    while (changed) {
      changed = false;
      for (let row = 1; row < MAP_ROWS - 1; row++) {
        for (let col = 1; col < MAP_COLS - 1; col++) {
          if (grid[row][col] !== TileType.GRASS) { continue; }
          if (heightmap[row][col] <= 1) { continue; }

          let similarNeighbors = 0;
          for (const [dc, dr] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            if (
              grid[row + dr][col + dc] === TileType.GRASS &&
              heightmap[row + dr][col + dc] === heightmap[row][col]
            ) {
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

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {number[][]} heightmap
   * @param {RiverData[]} riverData
   */
  applyHeightsToMetadata(grid, tileMeta, heightmap, riverData) {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        tileMeta[row][col] = {
          ...tileMeta[row][col],
          baseHeight: heightmap[row][col],
          renderMode: "SOLID",
        };

        const tile = grid[row][col];
        if (tile === TileType.CASTLE_WALL || tile === TileType.CASTLE_TOWER) {
          tileMeta[row][col].surfaceType = "STRUCTURE";
        } else if (tile === TileType.PATH) {
          tileMeta[row][col].surfaceType = "PATH";
        } else if (tile === TileType.ENTRY) {
          tileMeta[row][col].surfaceType = "STRUCTURE";
        } else if (tile === TileType.GRASS) {
          tileMeta[row][col].surfaceType = "GRASS";
        }
      }
    }

    this.#applyPathRenderModes(grid, heightmap, tileMeta);
    this.#assignBridgeGround(tileMeta, heightmap, riverData);
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {RiverData[]} riverData
   */
  materializePathSupports(grid, heightmap, tileMeta, riverData) {
    const riverCells = new Set(
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
    const processedStations = new Set();
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (grid[row][col] !== TileType.PATH) {
          continue;
        }
        if (tileMeta[row][col].shape === TILE_SHAPE.SLOPE) {
          continue;
        }
        if (tileMeta[row][col].overpassId) {
          continue;
        }
        const lateralCells = PathSurfaceRules.pathLateralCells(grid, tileMeta, col, row);
        if (!lateralCells) {
          continue;
        }
        const direction = tileMeta[row][col].direction;
        const axis =
          direction === DIRECTIONS.EAST ||
          direction === DIRECTIONS.WEST
            ? "H"
            : "V";
        const stationKey = `${axis}:${lateralCells
          .map(/**
           *
           * @param {MapCell} cell
           */
          (cell) => MapGrid.tileKey(cell.col, cell.row))
          .sort()
          .join("|")}`;
        if (processedStations.has(stationKey)) {
          continue;
        }
        processedStations.add(stationKey);

        const pathHeight = heightmap[row][col];
        const supportedSides = lateralCells.filter(
          /**
           *
           * @param {{col: number, row: number}} options
           * @param {number} options.col
           * @param {number} options.row
           */
          ({ col: sideCol, row: sideRow }) =>
            PathSurfaceRules.hasPathSideBlock(
              grid,
              heightmap,
              sideCol,
              sideRow,
              pathHeight,
            ),
        );
        if (
          supportedSides.length !== 1 &&
          !PathSurfaceRules.isPathTurnPosition(grid, lateralCells)
        ) {
          continue;
        }

        for (const { col: sideCol, row: sideRow } of lateralCells) {
          if (
            PathSurfaceRules.hasPathSideBlock(
              grid,
              heightmap,
              sideCol,
              sideRow,
              pathHeight,
            ) ||
            !MapGrid.inBounds(sideCol, sideRow) ||
            riverCells.has(MapGrid.tileKey(sideCol, sideRow))
          ) {
            continue;
          }
          MapGrid.setTile(grid, tileMeta, sideCol, sideRow, TileType.GRASS, {
            surfaceType: "GRASS",
            baseHeight: pathHeight,
          });
          heightmap[sideRow][sideCol] = pathHeight;
        }
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   */
  #applyPathRenderModes(grid, heightmap, tileMeta) {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (grid[row][col] !== TileType.PATH) {
          continue;
        }
        tileMeta[row][col].renderMode = PathSurfaceRules.classifyRenderMode(
          grid,
          heightmap,
          tileMeta,
          col,
          row,
        );
      }
    }
  }

  /**
   * @param {TileMetadata[][]} tileMeta
   * @param {number[][]} heightmap
   * @param {RiverData[]} riverData
   */
  #assignBridgeGround(tileMeta, heightmap, riverData) {
    const riverBridgeCells = new Set(
      riverData.flatMap(/**
       *
       * @param {RiverRecord} river
       */
      (river) =>
        river.cells
          .filter(/**
           *
           * @param {MapCell} cell
           */
          (cell) => cell.underBridge)
          .map(/**
           *
           * @param {MapCell} cell
           */
          (cell) => MapGrid.tileKey(cell.col, cell.row)),
      ),
    );
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (tileMeta[row][col].renderMode !== "BRIDGE") {
          continue;
        }
        tileMeta[row][col].bridgeGroundHeight = riverBridgeCells.has(
          MapGrid.tileKey(col, row),
        )
          ? null
          : Math.max(1, heightmap[row][col] - 1);
      }
    }
  }
}
