/**
 * Estimate direct airflow from live Ammo collision, including moving doors.
 * This is obstruction sampling, not a fluid simulation: indirect drafts are
 * not modeled. Recheck regularly so opening a door can admit ambient wind.
 */
export class ClothWindExposure {
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {number}
   */
  #width;
  /**
   * @type {number}
   */
  #height;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #start;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #end;
  /**
   * @type {number}
   */
  #nextSample = 0;
  /**
   * @type {number}
   */
  #exposure = 0;

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, root: import("playcanvas").Entity, width: number, height: number}} options
   */
  constructor({ pc, app, root, width, height }) {
    this.#app = app;
    this.#root = root;
    this.#width = width;
    this.#height = height;
    this.#start = new pc.Vec3();
    this.#end = new pc.Vec3();
  }

  /**
   * @param {import("../ObjectTypes.js").Point3} direction
   * @param {number} elapsed
   * @returns {number}
   * @type {(direction: import("../ObjectTypes.js").Point3, elapsed: number) => number}
   */
  sample = (direction, elapsed) => {
    if (elapsed < this.#nextSample) { return this.#exposure; }
    this.#nextSample = elapsed + 0.1;
    const physics = this.#app.systems.rigidbody;
    if (!physics?.raycastFirst) { return 1; }
    const length = Math.hypot(direction.x, direction.z);
    if (length < 0.000001) { return 0; }
    let clear = 0;
    for (const offset of [-0.3, 0, 0.3]) {
      this.#start.set(this.#width * offset, -this.#height * 0.5, 0.08);
      this.#root.getWorldTransform().transformPoint(this.#start, this.#start);
      this.#end.set(this.#start.x - direction.x / length * 64,
        this.#start.y, this.#start.z - direction.z / length * 64);
      if (!physics.raycastFirst(this.#start, this.#end)) { clear++; }
    }
    this.#exposure = clear / 3;
    return this.#exposure;
  };
}
