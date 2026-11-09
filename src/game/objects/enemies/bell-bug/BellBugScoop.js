/**
 * Nearby slimes take attention before royals, from any direction.
 */
export class BellBugScoop {
  /**
   * @type {number}
   */
  time = 0;
  /**
   * @type {number}
   */
  side = 0;
  /**
   * @type {import("../latch-slug/LatchSlug.js").LatchSlug|null}
   */
  target = null;
  /**
   * @type {import("../latch-slug/LatchSlug.js").LatchSlug|null}
   */
  attentionTarget = null;
  /**
   * @type {boolean}
   */
  contacted = false;
  /**
   * @type {import("../latch-slug/LatchSlug.js").LatchSlug|null}
   */
  approachTarget = null;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  approachPosition = null;
  /**
   * @type {number}
   */
  #approachAge = 0;

  /**
   * @param {import("./BellBug.js").BellBug} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @param {boolean} requireFacing
   * @returns {boolean}
   */
  reachable(actor, requireFacing = true) {
    const b = this.owner;
    if (!actor.annoyance || !actor.alive || actor.carrier || actor.airborne || actor.entity?.enabled === false
      || actor.gatewayArrival?.active || Math.abs(actor.position.y - b.position.y) > 0.5) {
      return false;
    }
    const offset = actor.position.clone().sub(b.position);
    const distance = offset.length();
    if (distance > 1 || distance < 0.01
      || requireFacing && offset.normalize().dot(b.entity.forward) < 0.65) {
      return false;
    }
    const start = b.position.clone().add(new b.pc.Vec3(0, 0.35, 0));
    const end = actor.position.clone().add(new b.pc.Vec3(0, 0.35, 0));
    const hits = b.app.systems?.rigidbody?.raycastAll(start, end) ?? [];

    return !hits.some(this.#blocks.bind(this, actor));
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @param {import("playcanvas").RaycastResult} hit
   * @returns {boolean}
   */
  #blocks(actor, hit) {
    return hit.entity !== this.owner.entity && !hit.entity.isDescendantOf(this.owner.entity)
      && hit.entity !== actor.entity && !hit.entity.isDescendantOf(actor.entity);
  }

  reset() {
    this.contact?.destroy();
    this.contact = null;
    this.target = null;
    this.attentionTarget = null;
    this.time = 0;
    this.contacted = false;
    this.pressed = false;
    this.tasted = false;
    this.approachTarget = null;
    this.approachPosition = null;
    this.#approachAge = 0;
  }

  /**
   * @param {number} dt
   * @param {boolean} pursuing
   */
  update(dt, pursuing) {
    const b = this.owner;
    if (!pursuing || !b.alive || b.carrier || b.airborne || b.gatewayArrival.active
      || b.statuses.has("stun") || b.statuses.has("confused")) {
      this.reset();

      return;
    }
    if (this.approachTarget) {
      this.#approachAge += dt;
      const target = this.approachTarget;
      if (!this.reachable(target) || this.#approachAge > 1.5) {
        this.reset();
      } else if (b.position.distance(this.approachPosition) < 0.004) {
        this.#begin(target);
      }

      return;
    }
    if (this.target) {
      if (!this.reachable(this.target) || !this.contact?.active) {
        this.reset();

        return;
      }
      b.stop();
      this.time += dt;
      if (!this.pressed && this.time >= 0.3) {
        this.pressed = true;
        this.target.audio?.play("scoopPress", 1.08 + this.side * 0.04);
      }
      if (!this.contacted && this.time >= 0.45) {
        const foot = b.animationPlayback?.scoopPose.foot(this.side);
        if (foot && !foot.canReach(this.contact.point)) {
          this.reset();

          return;
        }
        this.contacted = true;
        this.target.audio?.play("scoopPull", 1.06 + this.side * 0.04);
      }
      if (this.contacted && !this.tasted && this.time >= 0.92) {
        this.tasted = true;
        this.target.annoyance.scoop(b);
        this.target.audio?.play("scoopTaste", 1.12 + this.side * 0.04);
      }
      if (this.time >= 1.2) {
        this.side = 1 - this.side;
        this.reset();
      }

      return;
    }
    this.attentionTarget = null;
    let target = null;
    let distance = Infinity;
    for (const actor of b.actors) {
      if (!this.reachable(actor, false)) {
        continue;
      }
      const candidateDistance = actor.position.distance(b.position);
      if (candidateDistance < distance) {
        target = actor;
        distance = candidateDistance;
      }
    }
    if (target) {
      this.#begin(target);
      // Even a temporarily unavailable skin contact must not turn us back
      // toward a royal while this slime is within one tile.
      this.attentionTarget = target;
    }
  }

  /**
   * Ammo integrates the short step; the crowd planner retains every peer.
   */
  approach() {
    const b = this.owner;
    const moving = this.approachPosition && b.moveToward({ position: this.approachPosition }, 0.25, 0.002);
    b.playClip(moving ? "scuttle_walk" : "idle_nervous");
  }

  /**
   * @param {import("../latch-slug/LatchSlug.js").LatchSlug} target
   */
  #begin(target) {
    this.approachTarget = null;
    this.approachPosition = null;
    this.#approachAge = 0;
    this.target = target;
    this.contact = this.#contact(target);
    if (!this.contact) {
      this.target = null;
      if (!this.approachTarget) {
        this.reset();
      }

      return;
    }
    this.owner.stop();
    this.owner.playClip("idle_nervous");
  }

  /**
   * Prefer alternating feet, but do not repeat an unreachable foot forever.
   * Rejected samples release the slime's skin before trying the other socket.
   * @param {import("../latch-slug/LatchSlug.js").LatchSlug} target
   * @returns {import("../latch-slug/LatchScoopGel.js").LatchScoopGel|null}
   */
  #contact(target) {
    const b = this.owner;
    b.faceTarget?.(target);
    const direction = target.position.clone().sub(b.position);
    direction.y = 0;
    const clearance = b.radius + target.radius + 0.03;
    const available = direction.length() - clearance;
    direction.normalize();
    let step = Infinity;
    for (const side of [this.side, 1 - this.side]) {
      const contact = target.beginScoop?.(b, side);
      const foot = b.animationPlayback?.scoopPose.foot(side);
      if (contact?.active) {
        const needed = foot?.approachDistance?.(contact.point, direction);
        if ((!foot || foot.canReach(contact.point)) && (needed === undefined || needed !== null && needed < 0.005)) {
          this.side = side;

          return contact;
        }
        if (needed !== null && needed > 0 && needed <= available && needed < step) {
          step = needed;
        }
      }
      contact?.destroy();
    }
    if (Number.isFinite(step)) {
      const point = b.position.clone().add(direction.mulScalar(step));
      if (!b.stepSupport || b.stepSupport.surface(point.x, point.z, point.y + 0.32, point.y - 0.35)) {
        this.approachTarget = target;
        this.approachPosition = point;
      }
    }

    return null;
  }
}
