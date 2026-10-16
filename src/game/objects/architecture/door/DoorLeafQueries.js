/**
 * Local-space picking and camera queries for a rectangular animated leaf.
 * These queries do not simulate physical contacts: the camera and pointer are
 * not Ammo bodies. Doors with physical swing constraints supply an Ammo adapter.
 */
export class DoorLeafQueries {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #hinge;
  /**
   * @type {number}
   */
  #width;
  /**
   * @type {number}
   */
  #height;
  /**
   * @type {number}
   */
  #depth;

  /**
   * @param {{pc: typeof import("playcanvas"), hinge: import("playcanvas").Entity, width: number, height: number, depth: number}} options
   */
  constructor({ pc, hinge, width, height, depth }) {
    this.#pc = pc;
    this.#hinge = hinge;
    this.#width = width;
    this.#height = height;
    this.#depth = depth;
  }

  /**
   * @param {import("playcanvas").Vec3} rayStart
   * @param {import("playcanvas").Vec3} rayEnd
   * @returns {number|null}
   */
  raycast(rayStart, rayEnd) {
    if (!this.#hinge) {
      return null;
    }
    const inverse = this.#hinge.getWorldTransform().clone().invert();
    const start = inverse.transformPoint(rayStart, new this.#pc.Vec3());
    const end = inverse.transformPoint(rayEnd, new this.#pc.Vec3());
    const dz = end.z - start.z;
    if (Math.abs(dz) < 0.000001) {
      return null;
    }
    const distance = -start.z / dz;
    const x = start.x + (end.x - start.x) * distance;
    const y = start.y + (end.y - start.y) * distance;

    return distance < 0 || distance > 1 || x < 0 || x > this.#width || y < 0 || y > this.#height
      ? null : distance;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius
   * @returns {boolean}
   */
  blocksAt(x, y, z, radius = 0) {
    if (!this.#hinge) {
      return false;
    }
    const inverse = this.#hinge.getWorldTransform().clone().invert();
    const point = inverse.transformPoint(new this.#pc.Vec3(x, y, z), new this.#pc.Vec3());

    return point.x >= -radius && point.x <= this.#width + radius &&
      point.y >= -radius && point.y <= this.#height + radius &&
      Math.abs(point.z) <= this.#depth + radius;
  }

  destroy() {
    this.#hinge = null;
  }
}
