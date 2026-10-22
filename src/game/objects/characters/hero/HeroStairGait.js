import { Quat, Vec3 } from "playcanvas";

const STEP_DISTANCE = 0.24;
const SWING_CLEARANCE = 0.16;

/**
 * Alternating visual foot contacts, sampled from the existing physics world.
 */
export class HeroStairGait {
  /**
   * @type {Array<import("playcanvas").Vec3>}
   */
  #plants = [];
  /**
   * @type {Vec3|null}
   */
  #previous = null;
  /**
   * @type {Vec3|null}
   */
  #from = null;
  /**
   * @type {Vec3|null}
   */
  #target = null;
  /**
   * @type {number}
   */
  #swing = 0;
  /**
   * @type {number}
   */
  #progress = 0;
  /**
   * @type {boolean}
   */
  #transferring = false;

  /**
   * @returns {{swing: number|null, support: number, progress: number}}
   */
  get state() {
    return {
      swing: this.#transferring ? this.#swing : null,
      support: 1 - this.#swing,
      progress: this.#progress,
    };
  }

  /**
   * @param {number} deltaTime
   * @param {boolean} enabled
   * @param {Vec3} position
   * @param {Vec3} velocity
   * @param {Array<Vec3>} soles
   * @param {(x: number, z: number, maximumHeight: number) => import("src/game/objects/ObjectTypes.js").SurfaceSample|null} surfaceAt
   * @returns {Array<Vec3>|null}
   */
  update(deltaTime, enabled, position, velocity, soles, surfaceAt) {
    if (!enabled || (this.#previous && this.#previous.distance(position) > 1)) {
      this.#previous = null;
      this.#plants = [];
      this.#transferring = false;
      this.#progress = 0;

      return null;
    }
    if (!this.#previous) {
      this.#previous = position.clone();
      this.#plants = soles.map(/**
       *
       * @param {Vec3} sole
       */
        (sole) => this.#support(sole.clone(), position.y, surfaceAt));
    }
    const travel = Math.hypot(position.x - this.#previous.x, position.z - this.#previous.z);
    this.#previous.copy(position);
    const speed = Math.hypot(velocity.x, velocity.z);
    const gathering = speed <= 0.08 && Math.abs(this.#plants[0].y - this.#plants[1].y) > 0.08;
    if (!this.#transferring && (speed > 0.08 || gathering)) {
      const direction = new Vec3(velocity.x, 0, velocity.z).normalize();
      this.#from = this.#plants[this.#swing].clone();
      const lateral = soles[this.#swing].clone().sub(position);
      lateral.y = 0;
      lateral.sub(direction.clone().mulScalar(lateral.dot(direction)));
      this.#target = position.clone().add(lateral).add(direction.mulScalar(STEP_DISTANCE + 0.04));
      this.#support(this.#target, position.y, surfaceAt);
      this.#transferring = true;
      this.#progress = 0;
    }
    if (this.#transferring) {
      // Travel drives walking contacts. A released short tap completes just its
      // current transfer, rather than freezing a boot in the air.
      if (speed <= 0.08) {
        const remaining = this.#target.clone().sub(position);
        remaining.y = 0;
        if (remaining.length() > 0.23) {
          remaining.normalize().mulScalar(0.23);
          this.#target.x = position.x + remaining.x;
          this.#target.z = position.z + remaining.z;
          this.#support(this.#target, position.y, surfaceAt);
        }
      }
      this.#progress = Math.min(1, this.#progress + (speed > 0.08 ? travel / STEP_DISTANCE : deltaTime / 0.24));
      const blend = this.#progress * this.#progress * (3 - 2 * this.#progress);
      this.#plants[this.#swing].lerp(this.#from, this.#target, blend);
      this.#plants[this.#swing].y += Math.sin(Math.PI * this.#progress) * SWING_CLEARANCE;
      if (this.#progress === 1) {
        this.#transferring = false;
        this.#swing = 1 - this.#swing;
      }
    }

    return this.#plants;
  }

  /**
   * @param {Vec3} point
   * @param {number} height
   * @param {(x: number, z: number, maximumHeight: number) => import("src/game/objects/ObjectTypes.js").SurfaceSample|null} surfaceAt
   * @returns {Vec3}
   */
  #support(point, height, surfaceAt) {
    const surface = surfaceAt(point.x, point.z, height + 0.32);
    if (surface) {
      point.y = surface.height + 0.006;
    }

    return point;
  }

  /**
   * Bend the authored hip/knee chain; never translate the entire leg off its hip.
   * These are pose corrections only. Ammo continues to own body movement/contact.
   * @param {import("playcanvas").Entity} hip
   * @param {import("playcanvas").Entity} knee
   * @param {import("playcanvas").Entity} ankle
   * @param {import("playcanvas").Entity} hipCorrection
   * @param {import("playcanvas").Entity} kneeCorrection
   * @param {Vec3} sole
   * @param {Vec3} target
   * @param {Vec3} forward
   */
  static pose(hip, knee, ankle, hipCorrection, kneeCorrection, sole, target, forward) {
    const origin = hip.getPosition().clone();
    const joint = knee.getPosition().clone();
    const end = ankle.getPosition().clone();
    const upper = origin.distance(joint);
    const lower = joint.distance(end);
    const goal = end.clone().add(target.clone().sub(sole));
    const direction = goal.sub(origin);
    const distance = Math.max(Math.abs(upper - lower) + 0.001, Math.min(upper + lower - 0.001, direction.length()));
    direction.normalize();
    const bend = forward.clone().sub(direction.clone().mulScalar(forward.dot(direction))).normalize();
    const along = (upper * upper + distance * distance - lower * lower) / (2 * distance);
    const outward = Math.sqrt(Math.max(0, upper * upper - along * along));
    const desiredKnee = origin.clone().add(direction.clone().mulScalar(along)).add(bend.mulScalar(outward));
    const rotation = new Quat().setFromDirections(joint.sub(origin).normalize(), desiredKnee.clone().sub(origin).normalize());
    const hipRotation = new Quat().mul2(rotation, hipCorrection.getRotation());
    hipCorrection.setRotation(hipRotation.x, hipRotation.y, hipRotation.z, hipRotation.w);
    const currentKnee = knee.getPosition().clone();
    const desiredEnd = origin.add(direction.mulScalar(distance));
    const kneeRotation = new Quat().setFromDirections(ankle.getPosition().clone().sub(currentKnee).normalize(), desiredEnd.sub(currentKnee).normalize());
    const shinRotation = new Quat().mul2(kneeRotation, kneeCorrection.getRotation());
    kneeCorrection.setRotation(shinRotation.x, shinRotation.y, shinRotation.z, shinRotation.w);
  }
}
