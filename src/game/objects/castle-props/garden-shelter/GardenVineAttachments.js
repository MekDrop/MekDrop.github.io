import { Mat4, Vec3 } from "playcanvas";
import { GardenVineAttachmentNotFoundError } from "../../../errors/castle/index.js";

/**
 * Reads the ends of the visible authored stems in the model's own frame.
 */
export class GardenVineAttachments {
  /**
   * @param {import("playcanvas").Entity} model
   * @returns {Vec3[]}
   */
  static read(model) {
    return [GardenVineAttachments.#read(model, 0), GardenVineAttachments.#read(model, 1)];
  }

  /**
   * @param {import("playcanvas").Entity} model
   * @param {number} index
   * @returns {Vec3}
   */
  static #read(model, index) {
    const name = `Living vine shoot attachment ${index}`;
    const mesh = model.findByName(name)?.render?.meshInstances[0];
    if (!mesh) {
      throw new GardenVineAttachmentNotFoundError({ name });
    }

    return GardenVineAttachments.fromMesh(mesh, model);
  }

  /**
   * Preserve authored node offsets, model scale and rotation. Centre the bottom
   * ring rather than the full bounds, since the stem bends around the beam.
   * @param {import("playcanvas").MeshInstance} instance
   * @param {import("playcanvas").Entity} model
   * @returns {Vec3}
   */
  static fromMesh(instance, model) {
    const positions = [];
    instance.mesh.getPositions(positions);
    const transform = new Mat4().copy(model.getWorldTransform()).invert()
      .mul(instance.node.getWorldTransform());
    const points = [];
    let bottom = Infinity;
    for (let index = 0; index < positions.length; index += 3) {
      const point = transform.transformPoint(new Vec3(positions[index], positions[index + 1], positions[index + 2]));
      bottom = Math.min(bottom, point.y);
      points.push(point);
    }
    const minimum = new Vec3(Infinity, Infinity, Infinity);
    const maximum = new Vec3(-Infinity, -Infinity, -Infinity);
    for (const point of points) {
      if (point.y <= bottom + 0.00001) {
        minimum.min(point);
        maximum.max(point);
      }
    }

    return minimum.add(maximum).mulScalar(0.5);
  }
}
