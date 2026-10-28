import { ENEMY_TRAVERSAL } from "../enum/EnemyTraversal.js";
import { BridgeProfile } from "../objects/path/BridgeProfile.js";

/**
 * @typedef {{col:number, row:number, elevation:number, horizontal:boolean, overpass?:boolean, profile?:import("../generator/map/MapGenerationTypes.js").TileMetadata["bridgeProfile"]}} EnemyPathGap
 */

/**
 * Capability graphs share the original bridge topology. Removing a deck never
 * creates a shortcut over unrelated water, terrain, or another elevation.
 */
export class EnemyPaths {
  /**
   * @param {import("../GameContracts.js").GameMapData} map
   * @param {Map<string, Set<string>>} original
   * @param {Map<string, import("./WalkingPaths.js").WalkingPoint>} points
   */
  static rebuild(map, original, points) {
    const gaps = [];
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        const meta = map.tileMeta?.[row]?.[col];
        if (meta?.bridgeCollapsed || meta?.bridgeCollapsing || meta?.overpassCollapsed) {
          const overpass = meta?.overpassCollapsed && meta.overpass;
          gaps.push({
            col,
            row,
            elevation: overpass ? overpass.elevation : meta.bridgeProfile ? BridgeProfile.heightAt(meta.bridgeProfile, col, row) : map.heightmap[row][col],
            profile: overpass ? null : meta.bridgeProfile,
            horizontal: ["EAST", "WEST"].includes(overpass ? overpass.direction : meta.direction),
            overpass: Boolean(overpass),
          });
        }
      }
    }
    const navigation = {
      points,
      gaps,
      graphs: new Map(),
      drops: new Map(),
    };
    for (const capability of Object.values(ENEMY_TRAVERSAL)) {
      if (!gaps.length || capability === ENEMY_TRAVERSAL.FLYING) {
        navigation.graphs.set(capability, original);
        continue;
      }
      const graph = new Map();
      for (const [key, neighbors] of original) {
        const accepted = new Set();
        const first = points.get(key);
        for (const neighbor of neighbors) {
          const second = points.get(neighbor);
          const gap = EnemyPaths.#gapAt(gaps, (first.col + second.col) / 2,
            (first.row + second.row) / 2, (first.elevation + second.elevation) / 2);
          if (!gap || capability === ENEMY_TRAVERSAL.FLYING ||
            (capability === ENEMY_TRAVERSAL.JUMPING && !gap.overpass && EnemyPaths.#gapLength(gaps, gap) === 1)) {
            accepted.add(neighbor);
          }
        }
        graph.set(key, accepted);
      }
      EnemyPaths.#addOverpassDrops(map, graph, original, navigation);
      navigation.graphs.set(capability, graph);
    }
    Object.defineProperty(map, "enemyNavigation", {
      configurable: true,
      value: navigation,
    });

    return navigation.graphs.get(ENEMY_TRAVERSAL.WALKING);
  }

  /**
   * Keep the original upper crossing solely for flight. Grounded capabilities
   * can leave a surviving lip only toward an existing lower path node, never
   * climb the same edge in reverse or invent a route across grass or a void.
   * @param {import("../GameContracts.js").GameMapData} map
   * @param {Map<string, Set<string>>} graph
   * @param {Map<string, Set<string>>} original
   * @param {{points: Map<string, import("./WalkingPaths.js").WalkingPoint>, gaps: EnemyPathGap[], drops: Map<string, Set<string>>}} navigation
   */
  static #addOverpassDrops(map, graph, original, navigation) {
    const { points, gaps, drops } = navigation;
    for (const [key, accepted] of graph) {
      if (accepted.size === 0) {
        continue;
      }
      const source = points.get(key);
      let exposed = false;
      for (const neighbor of original.get(key)) {
        const second = points.get(neighbor);
        const gap = EnemyPaths.#gapAt(gaps, (source.col + second.col) / 2,
          (source.row + second.row) / 2, (source.elevation + second.elevation) / 2);
        exposed ||= gap?.overpass === true;
      }
      if (!exposed) {
        continue;
      }
      let destination = null;
      let nearest = Infinity;
      for (const [candidate, point] of points) {
        const col = Math.round(point.col);
        const row = Math.round(point.row);
        const metadata = map.tileMeta?.[row]?.[col];
        if (!metadata?.overpassCollapsed || point.elevation > source.elevation - 0.5 ||
          Math.abs(point.elevation - map.heightmap[row][col]) > 0.001) {
          continue;
        }
        const distance = Math.hypot(point.col - source.col, point.row - source.row);
        if (distance <= 2.1 && distance < nearest) {
          nearest = distance;
          destination = candidate;
        }
      }
      if (destination) {
        accepted.add(destination);
        const destinations = drops.get(key) ?? new Set();
        destinations.add(destination);
        drops.set(key, destinations);
      }
    }
  }

  /**
   * A swept body-sized check also keeps walkers away from the unsupported lip.
   * @param {{gaps: Array<{col:number,row:number,elevation:number,horizontal:boolean}>}} navigation
   * @param {{x:number,y:number,z:number}} from
   * @param {{x:number,y:number,z:number}} to
   * @param {number} radius
   * @param {number} cols
   * @param {number} rows
   */
  static crossing(navigation, from, to, radius, cols, rows) {
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.max(1, Math.ceil(distance / 0.1));
    for (let step = 0; step <= steps; step++) {
      const fraction = step / steps;
      const col = from.x + (to.x - from.x) * fraction + (cols - 1) / 2;
      const row = from.z + (to.z - from.z) * fraction + (rows - 1) / 2;
      for (const gap of navigation.gaps) {
        if (Math.abs(from.y - gap.elevation) < 0.9 &&
          Math.abs(col - gap.col) < 0.5 + radius && Math.abs(row - gap.row) < 0.5 + radius) {
          return gap;
        }
      }
    }

    return null;
  }

  /**
   * @param {Array<{col:number,row:number,elevation:number,horizontal:boolean}>} gaps
   * @param {{col:number,row:number,elevation:number,horizontal:boolean}} gap
   * @returns {number}
   */
  static gapLength(gaps, gap) {
    return EnemyPaths.#gapLength(gaps, gap);
  }

  /**
   * @param {Array<{col:number,row:number,elevation:number,horizontal:boolean}>} gaps
   * @param {{col:number,row:number,elevation:number,horizontal:boolean}} gap
   * @returns {number}
   */
  static #gapLength(gaps, gap) {
    let length = 1;
    for (const sign of [-1, 1]) {
      for (let offset = 1; offset <= gaps.length; offset++) {
        const col = gap.col + (gap.horizontal ? offset * sign : 0);
        const row = gap.row + (gap.horizontal ? 0 : offset * sign);
        const candidate = EnemyPaths.#gapAt(gaps,
          col, row, gap.profile ? BridgeProfile.heightAt(gap.profile, col, row) : gap.elevation);
        if (!candidate) {
          break;
        }
        length++;
      }
    }

    return length;
  }

  /**
   * @param {Array<{col:number,row:number,elevation:number,horizontal:boolean}>} gaps
   * @param {number} col
   * @param {number} row
   * @param {number} elevation
   */
  static #gapAt(gaps, col, row, elevation) {
    for (const gap of gaps) {
      const along = gap.horizontal ? Math.abs(col - gap.col) : Math.abs(row - gap.row);
      const across = gap.horizontal ? Math.abs(row - gap.row) : Math.abs(col - gap.col);
      const surface = gap.profile ? BridgeProfile.heightAt(gap.profile, col, row) : gap.elevation;
      if (along <= 0.5 && across <= 0.5 && Math.abs(elevation - surface) < 0.1) {
        return gap;
      }
    }

    return null;
  }
}
