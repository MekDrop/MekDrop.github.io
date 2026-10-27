import { ENEMY_TRAVERSAL } from "../enum/EnemyTraversal.js";

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
        if (meta?.bridgeCollapsed || meta?.bridgeCollapsing) {
          gaps.push({
            col,
            row,
            elevation: map.heightmap[row][col],
            horizontal: ["EAST", "WEST"].includes(meta.direction),
          });
        }
      }
    }
    const navigation = {
      points,
      gaps,
      graphs: new Map(),
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
            (capability === ENEMY_TRAVERSAL.JUMPING && EnemyPaths.#gapLength(gaps, gap) === 1)) {
            accepted.add(neighbor);
          }
        }
        graph.set(key, accepted);
      }
      navigation.graphs.set(capability, graph);
    }
    Object.defineProperty(map, "enemyNavigation", {
      configurable: true,
      value: navigation,
    });

    return navigation.graphs.get(ENEMY_TRAVERSAL.WALKING);
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
        const candidate = EnemyPaths.#gapAt(gaps,
          gap.col + (gap.horizontal ? offset * sign : 0),
          gap.row + (gap.horizontal ? 0 : offset * sign), gap.elevation);
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
      if (along <= 0.5 && across <= 0.5 && Math.abs(elevation - gap.elevation) < 0.1) {
        return gap;
      }
    }

    return null;
  }
}
