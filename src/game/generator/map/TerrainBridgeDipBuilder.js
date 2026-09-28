import { SLOPE_DIRECTION } from "../../enum/SlopeDirection.js";
import { TILE_SHAPE } from "../../enum/TileShape.js";
import {
  MAP_COLS,
  MAP_ROWS,
  PATH_HEIGHT,
  TERRAIN_BRIDGE_DIP_CHANCE,
  TERRAIN_BRIDGE_DIP_ELEVATION,
  TERRAIN_BRIDGE_DIP_RAMP_TILES,
  TERRAIN_BRIDGE_DIP_MIN_SPAN,
} from "./mapGenerationConfig.js";
import { MAP_DIRECTION as DIRECTIONS } from "../../enum/MapDirection.js";
import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { MapGrid } from "./MapGrid.js";
import { GenerationRandom } from "./GenerationRandom.js";
import { PathSurfaceRules } from "./PathSurfaceRules.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").MapCell} MapCell
 * @typedef {import("./MapGenerationTypes.js").RiverRecord} RiverRecord
 * @typedef {import("./MapGenerationTypes.js").RiverData} RiverData
 * @typedef {import("./MapGenerationTypes.js").PathDipSpan} PathDipSpan
 * @typedef {import("./MapGenerationTypes.js").PathDipPlan} PathDipPlan
 */

/**
 * Selects and materializes seeded two-lane terrain dips on eligible grass-backed spans.
 */
export class TerrainBridgeDipBuilder {
  /**
   * @type {import("./GenerationRandom.js").GenerationRandom}
   */
  #random;

  /**
   * @param {import("./GenerationRandom.js").GenerationRandom} random
   */
  constructor(random) {
    this.#random = random;
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {RiverData[]} riverData
   * @param {Set<string>} mergeZones
   */
  applyTerrainBridgeDips(
    grid,
    heightmap,
    tileMeta,
    riverData,
    mergeZones,
  ) {
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
    const stations = [];
    const seenStations = new Set();

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (grid[row][col] !== TileType.PATH) {
          continue;
        }
        const metadata = tileMeta[row][col];
        if (
          metadata.shape !== TILE_SHAPE.FLAT ||
          metadata.overpassId ||
          heightmap[row][col] !== PATH_HEIGHT
        ) {
          continue;
        }

        const horizontal =
          metadata.direction === DIRECTIONS.EAST ||
          metadata.direction === DIRECTIONS.WEST;
        const vertical =
          metadata.direction === DIRECTIONS.NORTH ||
          metadata.direction === DIRECTIONS.SOUTH;
        if (!horizontal && !vertical) {
          continue;
        }

        const mate = horizontal
          ? PathSurfaceRules.findLaneMateRow(grid, tileMeta, col, row, metadata.direction)
          : PathSurfaceRules.findLaneMateCol(grid, tileMeta, col, row, metadata.direction);
        if (mate === null) {
          continue;
        }

        const axis = horizontal ? "HORIZONTAL" : "VERTICAL";
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
            /**
             *
             * @param {MapCell} cell
             */
            (cell) =>
              mergeZones.has(MapGrid.tileKey(cell.col, cell.row)) ||
              riverBridgeCells.has(MapGrid.tileKey(cell.col, cell.row)) ||
              tileMeta[cell.row][cell.col].overpassId ||
              tileMeta[cell.row][cell.col].shape !== TILE_SHAPE.FLAT ||
              heightmap[cell.row][cell.col] !== PATH_HEIGHT ||
              PathSurfaceRules.classifyRenderMode(
                grid,
                heightmap,
                tileMeta,
                cell.col,
                cell.row,
              ) !== "BRIDGE",
          )
        ) {
          continue;
        }

        const lateralCells = PathSurfaceRules.pathLateralCells(
          grid,
          tileMeta,
          cells[0].col,
          cells[0].row,
        );
        if (
          !lateralCells ||
          lateralCells.some(
            /**
             *
             * @param {MapCell} cell
             */
            (cell) =>
              !MapGrid.inBounds(cell.col, cell.row) ||
              grid[cell.row][cell.col] !== TileType.GRASS ||
              heightmap[cell.row][cell.col] !==
                TERRAIN_BRIDGE_DIP_ELEVATION,
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
      group.sort(/**
       *
       * @param {{coordinate: number}} left
       * @param {{coordinate: number}} right
       */
      (left, right) => left.coordinate - right.coordinate);
      let run = [];
      const finishRun = () => {
        if (run.length >= TERRAIN_BRIDGE_DIP_MIN_SPAN) {
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
      /**
       *
       * @param {PathDipSpan} left
       * @param {PathDipSpan} right
       */
      (left, right) =>
        left.axis.localeCompare(right.axis) ||
        left.cross - right.cross ||
        left.start - right.start,
    );
    const plans = [];
    for (const span of eligibleSpans) {
      if (this.#random.rng(1, 100) > TERRAIN_BRIDGE_DIP_CHANCE) {
        continue;
      }
      const plan = this.#buildTerrainBridgeDipPlan(span, plans.length);
      this.#applyTerrainBridgeDipPlan(heightmap, tileMeta, plan);
      plans.push(plan);
    }
    return plans;
  }

  /**
   * @param {string} axis
   * @param {number} cross
   * @param {number} coordinate
   */
  #pathStationCells(axis, cross, coordinate) {
    return axis === "HORIZONTAL"
      ? [
          { col: coordinate, row: cross },
          { col: coordinate, row: cross + 1 },
        ]
      : [
          { col: cross, row: coordinate },
          { col: cross + 1, row: coordinate },
        ];
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {Set<string>} riverBridgeCells
   * @param {Set<string>} mergeZones
   * @param {PathDipSpan} span
   * @param {number} coordinate
   */
  #pathDipLandingFits(
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
        /**
         *
         * @param {MapCell} cell
         */
        (cell) =>
          !MapGrid.inBounds(cell.col, cell.row) ||
          grid[cell.row][cell.col] !== TileType.PATH ||
          mergeZones.has(MapGrid.tileKey(cell.col, cell.row)) ||
          riverBridgeCells.has(MapGrid.tileKey(cell.col, cell.row)) ||
          tileMeta[cell.row][cell.col].overpassId ||
          tileMeta[cell.row][cell.col].shape !== TILE_SHAPE.FLAT ||
          tileMeta[cell.row][cell.col].direction !== span.direction ||
          heightmap[cell.row][cell.col] !== PATH_HEIGHT ||
          PathSurfaceRules.classifyRenderMode(
            grid,
            heightmap,
            tileMeta,
            cell.col,
            cell.row,
          ) !== "SOLID",
      )
    ) {
      return false;
    }
    const lateralCells = PathSurfaceRules.pathLateralCells(
      grid,
      tileMeta,
      cells[0].col,
      cells[0].row,
    );
    return Boolean(
      lateralCells && !PathSurfaceRules.isPathTurnPosition(grid, lateralCells),
    );
  }

  /**
   * @param {PathDipSpan} span
   * @param {number} index
   */
  #buildTerrainBridgeDipPlan(span, index) {
    const firstRiseDirection =
      span.axis === "HORIZONTAL" ? SLOPE_DIRECTION.WEST : SLOPE_DIRECTION.NORTH;
    const lastRiseDirection =
      span.axis === "HORIZONTAL" ? SLOPE_DIRECTION.EAST : SLOPE_DIRECTION.SOUTH;
    const rampTiles = TERRAIN_BRIDGE_DIP_RAMP_TILES;
    const rampStep =
      (PATH_HEIGHT - TERRAIN_BRIDGE_DIP_ELEVATION) / rampTiles;
    const slopeCells = [];
    for (let offset = 0; offset < rampTiles; offset += 1) {
      const highHeight = PATH_HEIGHT - offset * rampStep;
      const lowHeight = highHeight - rampStep;
      slopeCells.push(
        ...this.#pathStationCells(
          span.axis,
          span.cross,
          span.start + offset,
        ).map(/**
         *
         * @param {MapCell} cell
         */
        (cell) => ({
          ...cell,
          lowHeight,
          highHeight,
          riseDirection: firstRiseDirection,
        })),
        ...this.#pathStationCells(span.axis, span.cross, span.end - offset).map(
          /**
           *
           * @param {MapCell} cell
           */
          (cell) => ({
            ...cell,
            lowHeight,
            highHeight,
            riseDirection: lastRiseDirection,
          }),
        ),
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
      elevation: TERRAIN_BRIDGE_DIP_ELEVATION,
      rampTiles,
      slopeCells,
      flatCells,
      landingCells: [
        ...this.#pathStationCells(span.axis, span.cross, span.start - 1),
        ...this.#pathStationCells(span.axis, span.cross, span.end + 1),
      ],
    };
  }

  /**
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {PathDipPlan} plan
   */
  #applyTerrainBridgeDipPlan(heightmap, tileMeta, plan) {
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
}
