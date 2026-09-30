import { MAP_TILE_TYPE } from "../enum/MapTileType.js";
import { RouteDataBuilder } from "../generator/map/RouteDataBuilder.js";

/**
 * @typedef {{col: number, row: number, elevation: number}} WalkingPoint
 * @typedef {{col: number, rows: number[]}} WalkingEntry
 * @typedef {{height: number, slope?: {lowHeight: number, highHeight: number, riseDirection: string}}} WalkingSurface
 */

/**
 * Rebuilds two-lane centerlines from tiles. Rebuild after editing tile topology.
 */
export class WalkingPaths {
  /**
   * Replaces routes and arrows atomically; consumers must read the current map
   * fields after a rebuild. Unreachable gates receive an empty route.
   * @param {import("../GameContracts.js").GameMapData} map
   * @returns {{graph: Map<string, Set<string>>, distances: Map<string, number>}}
   */
  static rebuild(map) {
    const graph = new Map();
    const points = new Map();
    /**
     * @param {number} col
     * @param {number} row
     * @param {boolean} upper
     */
    const surface = (col, row, upper) => {
      if (![MAP_TILE_TYPE.PATH, MAP_TILE_TYPE.ENTRY].includes(map.grid[row]?.[col])) {
        return null;
      }
      const meta = map.tileMeta?.[row]?.[col] ?? {};
      if (upper && meta.overpass) {
        return { height: meta.overpass.elevation };
      }
      return { height: map.heightmap[row][col], slope: meta.slope };
    };
    /**
     * @param {{height: number, slope?: {lowHeight: number, highHeight: number, riseDirection: string}}} tile
     * @param {number} dc
     * @param {number} dr
     */
    const heightAt = (tile, dc, dr) => {
      if (!tile.slope) { return tile.height; }
      const { lowHeight, highHeight, riseDirection } = tile.slope;
      const offset = { EAST: dc, WEST: -dc, SOUTH: dr, NORTH: -dr }[riseDirection];
      return (lowHeight + highHeight) / 2 + offset * (highHeight - lowHeight);
    };
    /**
     * @param {number} col
     * @param {number} row
     * @param {number} elevation
     */
    const node = (col, row, elevation) => {
      const key = `${col * 2},${row * 2},${Math.round(elevation * 1000) / 1000}`;
      if (!graph.has(key)) {
        graph.set(key, new Set());
        points.set(key, { col, row, elevation });
      }
      return key;
    };
    /**
     * @param {string} first
     * @param {string} second
     */
    const connect = (first, second) => {
      graph.get(first).add(second);
      graph.get(second).add(first);
    };
    for (let row = 0; row < map.rows - 1; row++) {
      for (let col = 0; col < map.cols - 1; col++) {
        for (const vertical of [false, true]) {
          for (const upper of [false, true]) {
            const tiles = [surface(col, row, upper), surface(col + 1, row, upper),
              surface(col, row + 1, upper), surface(col + 1, row + 1, upper)];
            if (tiles.some(/**
             *
             * @param {WalkingSurface} tile
             */
            (tile) => !tile)) { continue; }
            // Surfaces must agree at the center and across both lanes.
            const heights = tiles.map(/**
             *
             * @param {WalkingSurface} tile
             * @param {number} i
             */
            (tile, i) => heightAt(tile,
              i % 2 === 0 ? 0.5 : -0.5, i < 2 ? 0.5 : -0.5));
            if (Math.max(...heights) - Math.min(...heights) > 0.001) { continue; }
            const firstTiles = vertical ? [0, 1] : [0, 2];
            const secondTiles = vertical ? [2, 3] : [1, 3];
            const firstHeights = firstTiles.map(/**
             *
             * @param {number} i
             */
            (i) => heightAt(tiles[i],
              vertical ? (i % 2 === 0 ? 0.5 : -0.5) : 0,
              vertical ? 0 : (i < 2 ? 0.5 : -0.5)));
            const secondHeights = secondTiles.map(/**
             *
             * @param {number} i
             */
            (i) => heightAt(tiles[i],
              vertical ? (i % 2 === 0 ? 0.5 : -0.5) : 0,
              vertical ? 0 : (i < 2 ? 0.5 : -0.5)));
            if (Math.abs(firstHeights[0] - firstHeights[1]) > 0.001 ||
              Math.abs(secondHeights[0] - secondHeights[1]) > 0.001) { continue; }
            const center = node(col + 0.5, row + 0.5, heights[0]);
            connect(node(col + (vertical ? 0.5 : 0), row + (vertical ? 0 : 0.5), firstHeights[0]), center);
            connect(center, node(col + (vertical ? 0.5 : 1), row + (vertical ? 1 : 0.5), secondHeights[0]));
          }
        }
      }
    }
    const door = map.castle?.doors?.[0];
    const target = door ? [...points].find(/**
     *
     * @param {[string, WalkingPoint]} options
     * @param {string} options."0"
     * @param {WalkingPoint} options."1"
     */
    ([, point]) =>
      point.col === door.centerCol && point.row === door.centerRow)?.[0] : null;
    const distances = new Map(target ? [[target, 0]] : []);
    const queue = target ? [target] : [];
    for (let index = 0; index < queue.length; index++) {
      const key = queue[index];
      for (const neighbor of graph.get(key)) {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, distances.get(key) + 1);
          queue.push(neighbor);
        }
      }
    }
    const paths = (map.entries ?? []).map(/**
     *
     * @param {WalkingEntry} entry
     * @param {number} pathIdx
     */
    (entry, pathIdx) => {
      const row = entry.rows.reduce(/**
       *
       * @param {number} sum
       * @param {number} value
       */
      (sum, value) => sum + value, 0) / entry.rows.length;
      let key = [...points].find(/**
       *
       * @param {[string, WalkingPoint]} options
       * @param {string} options."0"
       * @param {WalkingPoint} options."1"
       */
      ([candidate, point]) => point.col === entry.col &&
        point.row === row && distances.has(candidate))?.[0];
      const route = [];
      while (key) {
        route.push(points.get(key));
        key = [...graph.get(key)].filter(/**
         *
         * @param {string} neighbor
         */
        (neighbor) =>
          distances.get(neighbor) === distances.get(key) - 1).sort()[0];
      }
      return { pathIdx, entry, route };
    });
    const arrowData = new RouteDataBuilder().buildArrowData(paths.map(/**
     *
     * @param {{route: WalkingPoint[]}} path
     */
    (path) => path.route));
    map.paths = paths;
    map.arrowData = arrowData;
    return { graph, distances };
  }
}
