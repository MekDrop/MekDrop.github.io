import { ENEMY_TRAVERSAL } from "../enum/EnemyTraversal.js";

/**
 * Draws three offset capability lanes around live deck gaps. These use the
 * exact graphs used by enemy steering, including disconnected waiting ends.
 */
export class EnemyPathDebug {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {import("../GameContracts.js").GameMapData|null}
   */
  mapData = null;
  /**
   * @type {boolean}
   */
  visible = false;
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #handle;

  /**
   * @param {{pc:typeof import("playcanvas"),app:import("playcanvas").Application}} options
   */
  constructor({ pc, app }) {
    this.#pc = pc;
    this.#app = app;
    this.#handle = app.on("update", this.#draw, this);
  }

  #draw() {
    const map = this.mapData;
    const navigation = map?.enemyNavigation;
    if (!this.visible || !navigation?.gaps.length) {
      return;
    }
    for (const [capability, graph] of navigation.graphs) {
      const color = capability === ENEMY_TRAVERSAL.WALKING ? new this.#pc.Color(1, 0.65, 0.15) :
        capability === ENEMY_TRAVERSAL.FLYING ? new this.#pc.Color(0.1, 0.9, 1) : new this.#pc.Color(0.85, 0.4, 1);
      for (const [key, neighbors] of graph) {
        const first = navigation.points.get(key);
        let gap = null;
        for (const candidate of navigation.gaps) {
          if (Math.hypot(first.col - candidate.col, first.row - candidate.row) < 3.5 && Math.abs(first.elevation - candidate.elevation) < 0.1) {
            gap = candidate;
            break;
          }
        }
        if (!gap) {
          continue;
        }
        const from = this.#world(first, gap, capability);
        for (const neighbor of neighbors) {
          if (neighbor < key) {
            continue;
          }
          const second = navigation.points.get(neighbor);
          this.#app.drawLine(from, this.#world(second, gap, capability), color, false);
        }
        const originalNeighbors = navigation.graphs.get(ENEMY_TRAVERSAL.FLYING).get(key);
        if (capability !== ENEMY_TRAVERSAL.FLYING && neighbors.size > 0 && neighbors.size < originalNeighbors.size &&
          Math.abs((gap.horizontal ? first.col - gap.col : first.row - gap.row)) <= 0.51) {
          const offset = new this.#pc.Vec3(0.14, 0, 0.14);
          this.#app.drawLine(from.clone().sub(offset), from.clone().add(offset), color, false);
          offset.z = -offset.z;
          this.#app.drawLine(from.clone().sub(offset), from.clone().add(offset), color, false);
        }
      }
    }
  }

  /**
   * @param {import("../navigation/WalkingPaths.js").WalkingPoint} point
   * @param {{col:number,row:number,horizontal:boolean}} gap
   * @param {string} capability
   */
  #world(point, gap, capability) {
    const lane = capability === ENEMY_TRAVERSAL.WALKING ? -0.45 : capability === ENEMY_TRAVERSAL.FLYING ? 0 : 0.45;
    const distance = Math.abs(gap.horizontal ? point.col - gap.col : point.row - gap.row);
    const lift = capability === ENEMY_TRAVERSAL.FLYING ? 0.8 :
      capability === ENEMY_TRAVERSAL.JUMPING ? 0.18 + Math.max(0, 1 - distance) * 0.65 : 0.15;

    return new this.#pc.Vec3(
      point.col - (this.mapData.cols - 1) / 2 + (gap.horizontal ? 0 : lane),
      point.elevation + lift,
      point.row - (this.mapData.rows - 1) / 2 + (gap.horizontal ? lane : 0),
    );
  }

  destroy() {
    this.#handle.off();
    this.mapData = null;
  }
}
