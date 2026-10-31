/**
 * Target-driven attention layered over authored head/stalk animation poses.
 */
export class LatchHeroGaze {
  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").Entity} model
   */
  constructor(owner, model) {
    this.owner = owner;
    this.head = model.findByName("head");
    this.eyes = [model.findByName("antenna_L"), model.findByName("antenna_R")].filter(Boolean);
    this.records = [this.head, ...this.eyes].filter(Boolean).map(/**
     *
     * @param {import("playcanvas").GraphNode} node
     */
      (node) => ({
        node,
        base: new owner.pc.Quat(),
        scale: new owner.pc.Vec3(),
      }));
    this.weight = 0;
    this.yaw = 0;
    this.lean = 14;
    this.lengthFactor = 1;
    this.isTracking = false;
    this.reason = "out of range";
    this.focus = new owner.pc.Vec3();
    this.direction = new owner.pc.Vec3(0, 0, -1);
    this.axis = new owner.pc.Vec3(-1, 0, 0);
    this.origin = new owner.pc.Vec3();
    this.local = new owner.pc.Vec3();
    this.inverse = new owner.pc.Mat4();
    this.rotation = new owner.pc.Quat();
    this.tilt = new owner.pc.Quat();
    this.result = new owner.pc.Quat();
    this.queryAge = 1;
    this.applied = false;
    this.handles = [owner.app.on("update", this.update, this),
      owner.app.on("prerender", this.apply, this),
      owner.app.on("postrender", this.restore, this)];
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }
    const owner = this.owner;
    this.queryAge += dt;
    const interrupted = !owner.alive || owner.carrier || owner.airborne || owner.gatewayArrival.active
      || owner.statuses.has("stun") || owner.statuses.has("confused")
      || owner.stateName === "LatchPressState" || owner.stateName === "LatchLeapState";
    if (interrupted) {
      this.isTracking = false;
      this.reason = "busy";
    } else if (this.queryAge >= 0.12) {
      this.queryAge = 0;
      this.#observe();
    }
    const blend = 1 - Math.exp(-dt * 8);
    this.weight += ((this.isTracking ? 1 : 0) - this.weight) * (1 - Math.exp(-dt * (this.isTracking ? 9 : 5)));
    if (this.isTracking) {
      const delta = this.focus.clone().sub(this.origin);
      const reach = owner.pc.math.clamp((Math.hypot(delta.x, delta.z) - 0.7) / 2.3, 0, 1);
      this.lengthFactor += (0.82 + reach * 0.43 - this.lengthFactor) * (1 - Math.exp(-dt * 6));
      this.inverse.invert(owner.entity.getWorldTransform()).transformVector(delta, this.local);
      const desiredYaw = owner.pc.math.clamp(Math.atan2(-this.local.x, -this.local.z) * 180 / Math.PI, -65, 65);
      this.yaw = owner.pc.math.lerpAngle(this.yaw, desiredYaw, blend);
      const elevation = Math.atan2(delta.y, Math.hypot(delta.x, delta.z)) * 180 / Math.PI;
      this.lean += (owner.pc.math.clamp(20 - elevation * 0.25, 8, 22) - this.lean) * blend;
      this.direction.set(delta.x, 0, delta.z).normalize();
      this.axis.cross(owner.entity.up, this.direction).normalize();
    }
  }

  #observe() {
    const owner = this.owner, hero = owner.resolvePackTarget?.() ?? owner.runtime.getHero?.();
    this.isTracking = false;
    if (!hero?.entity || hero.alive === false || hero.isDying) {
      this.reason = "no hero";

      return;
    }
    const position = hero.entity.getPosition();
    // Map tiles are one world metre; only direct, nearby attention is intended.
    if (Math.hypot(position.x - owner.position.x, position.z - owner.position.z) > 3) {
      this.reason = "out of range";

      return;
    }
    this.origin.copy(owner.position).add(new owner.pc.Vec3(0, 0.58, 0));
    this.focus.copy(position).add(new owner.pc.Vec3(0, (hero.height ?? 1.2) * 0.65, 0));
    const physics = owner.app.systems.rigidbody;
    if (!physics?.raycastFirst) {
      this.reason = "no visibility query";

      return;
    }
    this.heroEntity = hero.entity;
    const hit = physics.raycastFirst(this.origin, this.focus, {
      filterCallback: this.#occluder.bind(this),
    });
    this.isTracking = !hit;
    this.reason = hit ? "blocked" : "watching hero";
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {boolean}
   */
  #occluder(entity) {
    return entity !== this.owner.entity && !entity.isDescendantOf(this.owner.entity)
      && entity !== this.heroEntity && !entity.isDescendantOf(this.heroEntity)
      && entity.rigidbody?.enabled !== false;
  }

  apply() {
    this.restore();
    if (this.weight < 0.002 || !this.owner.alive) {
      return;
    }
    // Snapshot every local pose before the parent is tilted. Restore after all
    // cameras render, so paused or channel-less clips never accumulate offsets.
    for (const record of this.records) {
      record.base.copy(record.node.getLocalRotation());
      record.scale.copy(record.node.getLocalScale());
    }
    this.applied = true;
    if (this.head) {
      this.#turn(this.head, 0.2, 0.15);
    }
    for (const eye of this.eyes) {
      this.#turn(eye, 0.8, 0.85);
      // The authored stalk bones run along local Y; preserve their width.
      const scale = eye.getLocalScale();
      eye.setLocalScale(scale.x, scale.y * (1 + (this.lengthFactor - 1) * this.weight), scale.z);
    }
  }

  /**
   * @param {import("playcanvas").GraphNode} node
   * @param {number} yawFraction
   * @param {number} leanFraction
   */
  #turn(node, yawFraction, leanFraction) {
    this.rotation.setFromAxisAngle(this.owner.entity.up, this.yaw * yawFraction * this.weight);
    this.tilt.setFromAxisAngle(this.axis, this.lean * leanFraction * this.weight);
    this.rotation.mul2(this.tilt, this.rotation);
    this.result.mul2(this.rotation, node.getRotation());
    node.setRotation(this.result);
  }

  restore() {
    if (!this.applied) {
      return;
    }
    for (const record of this.records) {
      record.node.setLocalRotation(record.base);
      record.node.setLocalScale(record.scale);
    }
    this.applied = false;
  }

  destroy() {
    this.restore();
    for (const handle of this.handles) {
      handle.off();
    }
  }
}
