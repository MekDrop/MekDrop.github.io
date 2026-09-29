import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { MAP_DIRECTION as Direction } from "../../enum/MapDirection.js";
import { TILE_SHAPE } from "../../enum/TileShape.js";
import { MAP_COLS, MAP_ROWS } from "./mapGenerationConfig.js";

const CONNECTOR_CHANCE = 70;
const MIN_ISLAND_CELLS = 60;
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
    let best = null;
    const riverCells = riverData.flatMap(/**
     * @param {import("./MapGenerationTypes.js").RiverData} river
     */
    (river) => river.cells);
    const overpassCells = [];
    for (let row = 0; row < MAP_ROWS; row += 1) {
      for (let col = 0; col < MAP_COLS; col += 1) {
        if (tileMeta[row][col].overpassId || tileMeta[row][col].overpassPlateauId) {
          overpassCells.push({ col, row });
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
            ? { col: station, row: cross }
            : { col: cross, row: station };
          /**
           * @param {number} cross
           */
          const tileAt = (cross) => {
            const { col, row } = cell(cross);
            return grid[row][col];
          };
          if (tileAt(first) === TileType.WATER) continue;
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
            if (type === TileType.GRASS) grassCells.push(point);
            else if (type === TileType.PATH &&
              meta.shape !== TILE_SHAPE.SLOPE &&
              !meta.overpassId && !meta.pathDipId) pathCells.push(point);
            else valid = false;
          }
          first = last;
          if (!valid || pathCells.length !== 2 || grassCells.length === 0) continue;
          if (grassCells.some(/**
           * @param {{col: number, row: number}} grass
           */
          ({ col, row }) => riverCells.some(/**
            * @param {import("./MapGenerationTypes.js").RiverCell} river
            */
            (river) => Math.abs(river.col - col) + Math.abs(river.row - row) <= 5,
          ))) continue;
          if (grassCells.some(/**
           * @param {{col: number, row: number}} grass
           */
          ({ col, row }) => overpassCells.some(/**
            * @param {{col: number, row: number}} overpass
            */
            (overpass) => Math.abs(overpass.col - col) +
              Math.abs(overpass.row - row) <= 3,
          ))) continue;
          const [a, b] = pathCells;
          if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) !== 1) continue;
          const expectedDirections = horizontal
            ? [Direction.EAST, Direction.WEST]
            : [Direction.NORTH, Direction.SOUTH];
          if (!expectedDirections.includes(tileMeta[a.row][a.col].direction) ||
            tileMeta[a.row][a.col].direction !== tileMeta[b.row][b.col].direction) continue;
          const blocked = new Set([...pathCells, ...grassCells].map(/**
           * @param {{col: number, row: number}} point
           */
            ({ col, row }) => `${col},${row}`,
          ));
          const before = horizontal
            ? { col: station - 1, row: a.row }
            : { col: a.col, row: station - 1 };
          const after = horizontal
            ? { col: station + 1, row: a.row }
            : { col: a.col, row: station + 1 };
          const nearIsland = this.#flood(grid, before, blocked);
          if (nearIsland.size < MIN_ISLAND_CELLS ||
            nearIsland.has(`${after.col},${after.row}`)) continue;
          const farIsland = this.#flood(grid, after, blocked);
          if (farIsland.size < MIN_ISLAND_CELLS) continue;
          const score = Math.min(nearIsland.size, farIsland.size);
          if (!best || score > best.score) {
            best = {
              score, horizontal, station, pathCells, grassCells,
              nearIsland, farIsland,
            };
          }
        }
      }
    }
    if (!best || !random.deterministicChance(
      mapName, "split-island", CONNECTOR_CHANCE,
    )) return null;
    for (const { col, row } of best.grassCells) {
      grid[row][col] = TileType.WATER;
      heightmap[row][col] = 0;
      islandMask[row][col] = false;
      tileMeta[row][col] = {};
    }
    for (const { col, row } of best.pathCells) {
      tileMeta[row][col].islandConnector = true;
      best.nearIsland.add(`${col},${row}`);
    }
    return {
      horizontal: best.horizontal,
      station: best.station,
      cells: best.pathCells,
      removedCells: best.grassCells,
      nearIsland: [...best.nearIsland],
      farIsland: [...best.farIsland],
    };
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
        blocked.has(key) || visited.has(key) || grid[row][col] === TileType.WATER) continue;
      visited.add(key);
      queue.push(
        { col: col - 1, row }, { col: col + 1, row },
        { col, row: row - 1 }, { col, row: row + 1 },
      );
    }
    return visited;
  }
}
