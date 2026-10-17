import { ObjectDataCache } from "../../../cache/ObjectDataCache.js";

/**
 * Local bounds from the authored roof, independent of footprint and yaw.
 */
export class RoofCollisionLayout {
  /**
   * @param {import("playcanvas").Entity} model
   * @returns {RoofCollisionBox[]}
   */
  static read(model) {
    return ObjectDataCache.resolve("roofs", "blue-roof", () => this.#generate(model));
  }

  /**
   * @param {import("playcanvas").Entity} model
   * @returns {RoofCollisionBox[]}
   */
  static #generate(model) {
    const boxes = [];
    for (const render of model.findComponents("render")) {
      const name = render.entity.name;
      if (!name.startsWith("Hipped roof course") && name !== "Roof cap" &&
        !name.startsWith("Dormer stone body") && !name.startsWith("Dormer blue roof course")) {
        continue;
      }
      const bounds = render.meshInstances[0].mesh.aabb.clone();
      for (const instance of render.meshInstances.slice(1)) {
        bounds.add(instance.mesh.aabb);
      }
      const path = [];
      for (let node = render.entity; node !== model; node = node.parent) {
        path.unshift(node.parent.children.indexOf(node));
      }
      boxes.push({
        path,
        center: [bounds.center.x, bounds.center.y, bounds.center.z],
        halfExtents: [bounds.halfExtents.x, bounds.halfExtents.y, bounds.halfExtents.z],
      });
    }

    return boxes;
  }
}

/**
 * @typedef {{path: number[], center: number[], halfExtents: number[]}} RoofCollisionBox
 */
