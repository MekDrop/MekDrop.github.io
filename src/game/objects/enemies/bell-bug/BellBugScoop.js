/**
 * A blocked bug alternates its front feet, collecting once before each taste.
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
   * @type {boolean}
   */
  contacted = false;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  anchor = null;
  /**
   * @type {number}
   */
  blockedTime = 0;

  /**
   * @param {import("./BellBug.js").BellBug} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @returns {boolean}
   */
  reachable(actor) {
    const b = this.owner;
    if (!actor.annoyance || !actor.alive || actor.carrier || actor.airborne || actor.entity?.enabled === false
      || actor.gatewayArrival?.active || Math.abs(actor.position.y - b.position.y) > 0.5) {
      return false;
    }
    const offset = actor.position.clone().sub(b.position);
    const distance = offset.length();
    if (distance > b.radius + actor.radius + 0.45 || distance < 0.01
      || offset.normalize().dot(b.entity.forward) < 0.65) {
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
    this.time = 0;
    this.contacted = false;
    this.pressed = false;
    this.tasted = false;
    this.blockedTime = 0;
    this.anchor = null;
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
    const moved = this.anchor && this.anchor.distance(b.position) > 0.04;
    if (!this.anchor || moved) {
      this.anchor = b.position.clone();
      this.blockedTime = 0;
    }
    this.blockedTime += dt;
    if (this.blockedTime < 0.4) {
      return;
    }
    this.target = b.actors.find(this.reachable.bind(this)) ?? null;
    if (this.target) {
      this.contact = this.target.beginScoop?.(b, this.side);
      const foot = b.animationPlayback?.scoopPose.foot(this.side);
      if (!this.contact?.active || (foot && !foot.canReach(this.contact.point))) {
        this.reset();

        return;
      }
      b.stop();
      b.playClip("idle_nervous");
    }
  }
}
