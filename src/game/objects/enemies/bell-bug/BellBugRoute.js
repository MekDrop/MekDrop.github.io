/**
 * Follow the map-authored gateway route before approaching the royal.
 */
export class BellBugRoute {
  /**
   * @type {import("./BellBug.js").BellBug}
   */
  owner;
  /**
   * @type {import("../../../navigation/WalkingPaths.js").WalkingPoint[]|null}
   */
  #route = null;
  /**
   * @type {number}
   */
  #index = 0;

  /**
   * @param {import("./BellBug.js").BellBug} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @returns {{position:import("playcanvas").Vec3}|null}
   */
  next() {
    const b = this.owner, map = b.runtime.mapData;
    if (!b.definition.gatewayId || !map?.paths?.length) {
      return null;
    }
    const gate = map.objects?.find(/**
     *
     * @param {import("../../ObjectTypes.js").MapObjectDefinition} o
     */
      o => o.id === b.definition.gatewayId);
    if (!gate?.entry) {
      return null;
    }
    const path = map.paths.find(/**
     *
     * @param {{entry:{col:number,rows:number[]},route:import("../../../navigation/WalkingPaths.js").WalkingPoint[]}} p
     */
      p => p.entry?.col === gate.entry.col && p.entry?.rows?.[0] === gate.entry.rows[0]);
    if (!path?.route?.length) {
      return null;
    }
    const points = path.route.map(/**
     *
     * @param {import("../../../navigation/WalkingPaths.js").WalkingPoint} point
     * @param {number} index
     */
      (point, index) => b.pathLane.routePoint(path.route, index));
    if (this.#route !== path.route) {
      this.#route = path.route;
      this.#index = 0;
      let nearest = Infinity;
      for (const [index, point] of points.entries()) {
        const distance = Math.hypot(b.position.x - point.x, b.position.z - point.z);
        if (distance < nearest) {
          nearest = distance; this.#index = index;
        }
      }
    }
    while (this.#index < points.length) {
      const point = points[this.#index], next = points[this.#index + 1];
      const dx = b.position.x - point.x, dz = b.position.z - point.z;
      const distance = Math.hypot(dx, dz);
      const passed = next && distance < 1.2 && dx * (next.x - point.x) + dz * (next.z - point.z) > 0;
      if ((distance < 0.35 || passed) && Math.abs(b.position.y - point.y) < 0.4) {
        this.#index++;
      } else {
        break;
      }
    }

    return points[this.#index] ? { position: points[this.#index] } : null;
  }
}
