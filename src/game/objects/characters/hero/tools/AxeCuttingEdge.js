import { Vec3 } from "playcanvas";

/**
 * Samples the authored sharpened edge, excluding the cheek and handle.
 */
export class AxeCuttingEdge {
  /**
   * @type {Array<{node: import("playcanvas").GraphNode, point: Vec3, world: Vec3}>}
   */
  #samples = [];

  /**
   * @param {import("playcanvas").Entity} tool
   */
  constructor(tool) {
    const candidates = [];
    const seen = new Set();
    for (const render of tool.findComponents("render")) {
      for (const instance of render.meshInstances) {
        if (instance.material.name !== "Honed convex cutting edge") {
          continue;
        }
        const positions = [];
        const indices = [];
        instance.mesh.getPositions(positions);
        instance.mesh.getIndices(indices);
        for (const index of new Set(indices)) {
          const point = new Vec3(...positions.slice(index * 3, index * 3 + 3));
          const world = instance.node.getWorldTransform().transformPoint(point);
          const key = [world.x, world.y, world.z].map(/**
           *
           * @param {number} v
           */
            v => v.toFixed(5)).join(",");
          if (!seen.has(key)) {
            seen.add(key);
            candidates.push({
              node: instance.node,
              point,
              world,
            });
          }
        }
      }
    }
    if (candidates.length) {
      this.#samples.push(candidates.shift());
    }
    while (candidates.length && this.#samples.length < 12) {
      let best = 0;
      let farthest = -1;
      for (let index = 0; index < candidates.length; index++) {
        const distance = Math.min(...this.#samples.map(/**
         *
         * @param {{world: Vec3}} sample
         */
          sample =>
            candidates[index].world.distance(sample.world)));
        if (distance > farthest) {
          best = index;
          farthest = distance;
        }
      }
      this.#samples.push(candidates.splice(best, 1)[0]);
    }
  }

  points() {
    return this.#samples.map(/**
     *
     * @param {{node: import("playcanvas").GraphNode, point: Vec3}} options
     * @param {import("playcanvas").GraphNode} options.node
     * @param {Vec3} options.point
     */
      ({ node, point }) => node.getWorldTransform().transformPoint(point));
  }
}
