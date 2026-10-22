import { State } from "yuka";

/**
 * Demand first place, then use a collision-constrained shoulder route past the queue.
 */
export class CrownCrabQueueState extends State {
  /**
   * @type {number}
   */
  #time = 0;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #waypoint = null;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #forwardPoint = null;

  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  enter(crab) {
    this.#time = 0;
    this.#forwardPoint = crab.queueBypassPoint();
    this.#waypoint = this.#forwardPoint?.clone() ?? null;
    if (this.#waypoint) {
      const target = crab.targetPosition(crab.pursuitTarget);
      const direction = target.clone().sub(crab.position);
      direction.y = 0;
      direction.normalize();
      const ahead = this.#waypoint.clone().sub(crab.position).dot(direction);
      this.#waypoint.sub(direction.mulScalar(ahead));
    }
    crab.stop();
    crab.requestAnimation("angry_warn", true);
  }

  /**
   * @param {import("../CrownCrab.js").CrownCrab} crab
   */
  execute(crab) {
    if (crab.grudgesSuppressed) {
      crab.resumePursuit();

      return;
    }
    this.#time += crab.deltaTime;
    if (this.#waypoint && crab.position.distance(this.#waypoint) < 0.2 && this.#forwardPoint) {
      this.#waypoint = this.#forwardPoint;
      this.#forwardPoint = null;
    }
    if (!this.#waypoint || this.#time > 8 || crab.position.distance(this.#waypoint) < 0.2) {
      crab.queueRetryAfter = crab.elapsed + 1;
      crab.resumePursuit();

      return;
    }
    if (this.#time > 0.65) {
      crab.requestAnimation(this.#forwardPoint ? "scuttle_sideways" : "scuttle_forward");
      crab.moveToward({ position: this.#waypoint }, this.#forwardPoint ? 0.58 : 0.6);
      crab.facePursuitTarget();
    }
  }
}
