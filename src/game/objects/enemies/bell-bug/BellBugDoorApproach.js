/**
 * Leave the road at the landing and approach the face of a closed leaf.
 * A route node behind the door otherwise steers a small capsule into its jamb.
 */
export class BellBugDoorApproach {
  /**
   * @type {import("../../architecture/door/Door.js").Door|null}
   */
  #door = null;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #normal = null;

  /**
   * @param {import("./BellBug.js").BellBug} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * Keep climbing the authored flight until the door's landing is reached.
   * @param {import("../../architecture/door/Door.js").Door|null} door
   * @returns {{position:import("playcanvas").Vec3}|null}
   */
  next(door) {
    const b = this.owner;
    if (!door || door.broken || door.openAmount >= 0.15) {
      this.#door = null;
      this.#normal = null;

      return null;
    }
    const center = door.entity.getPosition();
    if (Math.abs(center.y - b.position.y) > 0.15 ||
      Math.hypot(center.x - b.position.x, center.z - b.position.z) > 1.8) {
      return null;
    }
    if (this.#door !== door) {
      this.#door = door;
      this.#normal = door.entity.forward.clone();
      this.#normal.y = 0;
      this.#normal.normalize();
      if (b.position.clone().sub(center).dot(this.#normal) < 0) {
        this.#normal.mulScalar(-1);
      }
    }
    const position = center.clone().add(this.#normal.clone().mulScalar(b.radius + 0.12));
    const support = b.stepSupport.surface(position.x, position.z, b.position.y + 0.32, b.position.y - 0.35);
    if (!support) {
      return null;
    }
    position.y = support.point.y;

    return { position };
  }
}
