import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { MAP_DIRECTION as Direction } from "../../enum/MapDirection.js";
import { PathSurfaceRules } from "./PathSurfaceRules.js";
import { TILE_SHAPE } from "../../enum/TileShape.js";
import { MAP_COLS, MAP_ROWS } from "./mapGenerationConfig.js";

const CONNECTOR_CHANCE = 70;
const MAX_NECK_WIDTH = 7;

/**
 * Removes a narrow land neck only when the two-lane route remains its crossing.
 */
export class IslandConnectorBuilder {
  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {import("./MapGenerationTypes.js").TileMetadata[][]} tileMeta
   * @param {boolean[][]} islandMask
   * @param {string} mapName
   * @param {import("./GenerationRandom.js").GenerationRandom} random
   * @param {import("./MapGenerationTypes.js").RiverData[]} riverData
   */
  build(grid, heightmap, tileMeta, islandMask, mapName, random, riverData) {
    if (!random.deterministicChance(mapName, "split-island", CONNECTOR_CHANCE)) {
      return null;
    }
    const connectors = [];
    const connectorCells = new Set();
    while (true) {
      let best = null;
      const riverCells = riverData.flatMap(
        IslandConnectorBuilder.#flatMapRiver,
      );
      const overpassCells = [];
      for (let row = 0; row < MAP_ROWS; row += 1) {
        for (let col = 0; col < MAP_COLS; col += 1) {
          if (tileMeta[row][col].overpassId || tileMeta[row][col].overpassPlateauId) {
            overpassCells.push({
              col,
              row,
            });
          }
        }
      }
      for (const horizontal of [false, true]) {
        const outerLimit = horizontal ? MAP_COLS : MAP_ROWS;
        const innerLimit = horizontal ? MAP_ROWS : MAP_COLS;
        for (let station = 2; station < outerLimit - 2; station += 1) {
          for (let first = 1; first < innerLimit - 2; first += 1) {
            /**
             * @param {number} cross
             */
            const cell = (cross) => horizontal
              ? {
                col: station,
                row: cross,
              }
              : {
                col: cross,
                row: station,
              };
            /**
             * @param {number} cross
             */
            const tileAt = (cross) => {
              const { col, row } = cell(cross);

              return grid[row][col];
            };
            if (tileAt(first) === TileType.WATER) {
              continue;
            }
            let last = first;
            while (last + 1 < innerLimit && tileAt(last + 1) !== TileType.WATER) {
              last += 1;
            }
            if (last - first + 1 > MAX_NECK_WIDTH) {
              first = last;
              continue;
            }
            const pathCells = [];
            const grassCells = [];
            let valid = true;
            for (let cross = first; cross <= last; cross += 1) {
              const point = cell(cross);
              const type = tileAt(cross);
              const meta = tileMeta[point.row][point.col];
              if (type === TileType.GRASS) {
                grassCells.push(point);
              } else if (type === TileType.PATH &&
                meta.shape !== TILE_SHAPE.SLOPE &&
                !meta.overpassId && !meta.pathDipId && !meta.islandConnector) {
                pathCells.push(point);
              } else {
                valid = false;
              }
            }
            first = last;
            if (!valid || pathCells.length !== 2 || grassCells.length === 0) {
              continue;
            }
            /**
             * @param {{col: number, row: number}} grass
             */
            const isNearRiver = ({ col, row }) => riverCells.some(/**
              * @param {import("./MapGenerationTypes.js").RiverCell} river
              */
              (river) => Math.abs(river.col - col) + Math.abs(river.row - row) <= 5,
            );
            if (grassCells.some(isNearRiver)) {
              continue;
            }
            /**
             * @param {{col: number, row: number}} grass
             */
            const isNearOverpass = ({ col, row }) => overpassCells.some(/**
              * @param {{col: number, row: number}} overpass
              */
              (overpass) => Math.abs(overpass.col - col) +
                Math.abs(overpass.row - row) <= 3,
            );
            if (grassCells.some(isNearOverpass)) {
              continue;
            }
            const [a, b] = pathCells;
            if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) !== 1) {
              continue;
            }
            const expectedDirections = horizontal
              ? [Direction.EAST, Direction.WEST]
              : [Direction.NORTH, Direction.SOUTH];
            if (!expectedDirections.includes(tileMeta[a.row][a.col].direction) ||
              tileMeta[a.row][a.col].direction !== tileMeta[b.row][b.col].direction) {
              continue;
            }
            if (this.#hasConnectorOnStraightRun(grid, tileMeta, pathCells, horizontal)) {
              continue;
            }
            const blocked = new Set([
              ...connectorCells,
              ...[...pathCells, ...grassCells].map(IslandConnectorBuilder.#map),
            ]);
            const before = horizontal
              ? {
                col: station - 1,
                row: a.row,
              }
              : {
                col: a.col,
                row: station - 1,
              };
            const after = horizontal
              ? {
                col: station + 1,
                row: a.row,
              }
              : {
                col: a.col,
                row: station + 1,
              };
            const bridgePositions = [...pathCells];
            for (const cell of pathCells) {
              for (const step of [-1, 1]) {
                bridgePositions.push({
                  col: cell.col + (horizontal ? step : 0),
                  row: cell.row + (horizontal ? 0 : step),
                });
              }
            }
            /**
             * @param {{col: number, row: number}} cell
             */
            const isBridgeCell = ({ col, row }) => PathSurfaceRules.classifyRenderMode(
              grid, heightmap, tileMeta, col, row,
            ) === "BRIDGE";
            if (bridgePositions.some(isBridgeCell)) {
              continue;
            }
            const nearIsland = this.#flood(grid, before, blocked);
            if (nearIsland.size === 0 ||
              nearIsland.has(`${after.col},${after.row}`)) {
              continue;
            }
            const farIsland = this.#flood(grid, after, blocked);
            if (farIsland.size === 0) {
              continue;
            }
            if (this.#isolatesGrass(grid, heightmap, grassCells)) {
              continue;
            }
            const score = Math.min(nearIsland.size, farIsland.size);
            if (!best || score > best.score) {
              best = {
                score,
                horizontal,
                station,
                pathCells,
                grassCells,
                nearIsland,
                farIsland,
              };
            }
          }
        }
      }
      if (!best) {
        break;
      }
      for (const { col, row } of best.grassCells) {
        grid[row][col] = TileType.WATER;
        heightmap[row][col] = 0;
        islandMask[row][col] = false;
        tileMeta[row][col] = {};
      }
      for (const { col, row } of best.pathCells) {
        tileMeta[row][col].islandConnector = true;
        connectorCells.add(`${col},${row}`);
      }
      connectors.push({
        horizontal: best.horizontal,
        station: best.station,
        cells: best.pathCells,
        removedCells: best.grassCells,
        nearIsland: [...best.nearIsland],
        farIsland: [...best.farIsland],
      });
    }
    if (!connectors.length) {
      return null;
    }
    const islands = [];
    const visited = new Set(connectorCells);
    for (let row = 0; row < MAP_ROWS; row += 1) {
      for (let col = 0; col < MAP_COLS; col += 1) {
        if (grid[row][col] === TileType.WATER || visited.has(`${col},${row}`)) {
          continue;
        }
        const cells = this.#flood(grid, {
          col,
          row,
        }, connectorCells);
        for (const key of cells) {
          visited.add(key);
        }
        islands.push([...cells]);
      }
    }
    for (const connector of connectors) {
      const first = connector.cells[0];
      const ownerKey = connector.horizontal
        ? `${first.col - 1},${first.row}`
        : `${first.col},${first.row - 1}`;
      const owner = islands.find(/**
       *
       * @param {string[]} cells
       */
        (cells) => cells.includes(ownerKey));
      for (const { col, row } of connector.cells) {
        owner.push(`${col},${row}`);
      }
    }

    return {
      ...connectors[0],
      cells: connectors.flatMap(IslandConnectorBuilder.#flatMapConnector),
      removedCells: connectors.flatMap(
        IslandConnectorBuilder.#flatMapConnector2,
      ),
      islands,
      connectors,
      nearIsland: islands[0],
      farIsland: islands[1],
    };
  }

  /**
   * Keep one continuous straight route from becoming alternating bridges and slivers.
   * @param {number[][]} grid
   * @param {import("./MapGenerationTypes.js").TileMetadata[][]} tileMeta
   * @param {Array<{col: number, row: number}>} pathCells
   * @param {boolean} horizontal
   * @returns {boolean}
   */
  #hasConnectorOnStraightRun(grid, tileMeta, pathCells, horizontal) {
    const direction = tileMeta[pathCells[0].row][pathCells[0].col].direction;
    for (const step of [-1, 1]) {
      for (let distance = 1; ; distance += 1) {
        const cells = pathCells.map(/**
         * @param {{col: number, row: number}} cell
         */
          (cell) => ({
            col: cell.col + (horizontal ? step * distance : 0),
            row: cell.row + (horizontal ? 0 : step * distance),
          }));
        /**
         * @param {{col: number, row: number}} cell
         */
        const isInvalidConnectorCell = ({ col, row }) => grid[row]?.[col] !== TileType.PATH ||
          tileMeta[row][col].direction !== direction;
        if (cells.some(isInvalidConnectorCell)) {
          break;
        }
        /**
         * @param {{col: number, row: number}} cell
         */
        const isExistingConnector = ({ col, row }) => tileMeta[row][col].islandConnector;
        if (cells.some(isExistingConnector)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Removing a neck must not strand a raised grass column without its hillside.
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {Array<{col: number, row: number}>} removedCells
   * @returns {boolean}
   */
  #isolatesGrass(grid, heightmap, removedCells) {
    const removed = new Set(removedCells.map(IslandConnectorBuilder.#mapCell));
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const cell of removedCells) {
      for (const [dc, dr] of directions) {
        const col = cell.col + dc;
        const row = cell.row + dr;
        if (col <= 0 || col >= MAP_COLS - 1 || row <= 0 || row >= MAP_ROWS - 1 ||
          grid[row][col] !== TileType.GRASS || heightmap[row][col] <= 1 ||
          removed.has(`${col},${row}`)) {
          continue;
        }
        const related = directions.some(/**
         * @param {number[]} direction
         */
          ([dx, dy]) => grid[row + dy][col + dx] === TileType.GRASS &&
          !removed.has(`${col + dx},${row + dy}`) &&
          heightmap[row + dy][col + dx] >= heightmap[row][col] - 1);
        if (!related) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * @param {number[][]} grid
   * @param {{col: number, row: number}} start
   * @param {Set<string>} blocked
   */
  #flood(grid, start, blocked) {
    const visited = new Set();
    const queue = [start];
    for (let index = 0; index < queue.length; index += 1) {
      const { col, row } = queue[index];
      const key = `${col},${row}`;
      if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS ||
        blocked.has(key) || visited.has(key) || grid[row][col] === TileType.WATER) {
        continue;
      }
      visited.add(key);
      queue.push(
        {
          col: col - 1,
          row,
        }, {
          col: col + 1,
          row,
        },
        {
          col,
          row: row - 1,
        }, {
          col,
          row: row + 1,
        },
      );
    }

    return visited;
  }

  /**
   * @param {import("./MapGenerationTypes.js").RiverData} river
   */
  static #flatMapRiver(river) {
    return river.cells;
  }

  /**
   * @param {{col: number, row: number}} point
   */
  static #map({ col, row }) {
    return `${col},${row}`;
  }

  /**
   *
   * @param {{cells: Array<{col: number, row: number}>, removedCells: Array<{col: number, row: number}>}} connector
   */
  static #flatMapConnector(connector) {
    return connector.cells;
  }

  /**
   *
   * @param {{cells: Array<{col: number, row: number}>, removedCells: Array<{col: number, row: number}>}} connector
   */
  static #flatMapConnector2(connector) {
    return connector.removedCells;
  }

  /**
   * @param {{col: number, row: number}} cell
   */
  static #mapCell(cell) {
    return `${cell.col},${cell.row}`;
  }
}
