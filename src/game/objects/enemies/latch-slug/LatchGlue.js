const doorMasses = new WeakMap();

/**
 * Independent, bounded restraint lifetime. No damage and no living collider.
 */
export class LatchGlue {
  /**
   * @type {LatchGlue|null}
   */
  #mergedInto = null;
  /**
   * @type {Set<LatchGlue>}
   */
  #members = new Set();
  /**
   * @type {import("../../architecture/door/Door.js").Door|null}
   */
  #door;
  /**
   * @type {number}
   */
  #remaining;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #visual = null;
  /**
   * @type {import("./LatchSplash.js").LatchSplash|null}
   */
  #splash = null;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #anchor = null;

  /**
   * @param {import("../../architecture/door/Door.js").Door|null} door
   * @param {number} duration
   * @param {import("./LatchSlug.js").LatchSlug|null} owner
   * @param {import("playcanvas").Vec3|null} impact
   */
  constructor(door, duration = 20, owner = null, impact = null) {
    this.#door = door;
    this.#remaining = Number.isFinite(duration) ? Math.max(0, Math.min(30, duration)) : 20;
    if (!this.active) {
      this.#door = null;

      return;
    }
    if (door && !door.jamShut(this)) {
      this.#remaining = 0;
    }
    if (this.active && owner?.app) {
      this.#createVisual(owner, impact);
      const masses = doorMasses.get(door) ?? new Set();
      doorMasses.set(door, masses);
      masses.add(this);
    }
  }

  /**
   * Bounded, collider-free residue stays attached to the actual door frame.
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").Vec3|null} impact
   */
  #createVisual(owner, impact) {
    const { pc } = owner;
    this.#splash = owner.splash;
    this.#visual = this.#splash.entity;
    // Door source hierarchies can be disabled after render batching. Keep the
    // transient effect in the live scene and anchor it to the frame transform.
    const frame = this.#door.entity;
    // The center seam is deliberately empty in double-leaf collision meshes.
    // Sample beside it, then carry that surface depth back to the seam.
    const besideSeam = frame.right.clone().mulScalar(0.2);
    const start = owner.position.clone().add(new pc.Vec3(0, 0.4, 0)).add(besideSeam);
    const end = frame.getPosition().clone().add(new pc.Vec3(0, 0.4, 0)).add(besideSeam);
    const contact = this.#door.getHit?.(start, end);
    const surface = impact?.clone() ?? (contact ? start.clone().lerp(start, end, contact.distance)
      .sub(besideSeam).add(start.clone().sub(end).normalize().mulScalar(0.04)) : owner.position.clone());
    if (impact) {
      const outward = owner.position.clone().sub(impact);
      outward.y = 0;
      surface.add(outward.normalize().mulScalar(0.008));
    } else {
      surface.y = frame.getPosition().y;
    }
    this.#anchor = frame.getWorldTransform().clone().invert().transformPoint(surface);
    this.#visual.setPosition(surface);
    this.#visual.setRotation(frame.getRotation());
    this.#splash.play(owner.position.clone().sub(surface).dot(frame.forward), surface.y - frame.getPosition().y, this.#door);
  }

  /**
   * @param {import("playcanvas").Vec3} rayStart
   * @param {import("playcanvas").Vec3} rayEnd
   * @param {typeof import("playcanvas")} pc
   * @returns {{distance:number,point:import("playcanvas").Vec3}|null}
   */
  getPointerHit(rayStart, rayEnd, pc) {
    if (this.#mergedInto) {
      return this.#mergedInto.getPointerHit(rayStart, rayEnd, pc);
    }
    if (!this.active || !this.#visual) {
      return null;
    }
    const meshes = this.#visual.findComponents("render").filter(/**
     *
     * @param {import("playcanvas").RenderComponent} render
     */
      (render) => render.entity.enabled && render.meshInstances.some(/**
       *
       * @param {import("playcanvas").MeshInstance} instance
       */
        (instance) => instance.visible));
    if (!meshes.length) {
      return null;
    }
    const bounds = meshes[0].meshInstances[0].aabb.clone();
    for (const render of meshes.slice(1)) {
      bounds.add(render.meshInstances[0].aabb);
    }
    const point = new pc.Vec3();
    const direction = rayEnd.clone().sub(rayStart).normalize();
    const hit = bounds.intersectsRay(new pc.Ray(rayStart, direction), point);
    const distance = point.distance(rayStart);

    const length = rayEnd.distance(rayStart);

    return hit && length > 0 && distance <= length ? {
      distance: distance / length,
      point,
    } : null;
  }

  /**
   * @returns {boolean}
   */
  get active() {
    return this.#remaining > 0;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }
    if (this.#mergedInto?.active) {
      return;
    }
    this.#remaining = Math.max(0, this.#remaining - dt);
    if (this.#visual && this.#door?.entity) {
      this.#visual.setPosition(this.#door.entity.getWorldTransform().transformPoint(this.#anchor));
      this.#visual.setRotation(this.#door.entity.getRotation());
      this.#splash.update(dt);
      this.#joinTouchingMasses();
    }
    if (!this.active || (this.#door && !this.#door.jammed)) {
      this.clear();
    }
  }

  #joinTouchingMasses() {
    for (const mass of doorMasses.get(this.#door) ?? []) {
      if (mass === this || !mass.active || mass.#remaining > this.#remaining ||
        mass.#splash.surface.normalSign !== this.#splash.surface.normalSign ||
        !mass.#splash.surface.touches(this.#splash.surface)) {
        continue;
      }
      mass.#splash.surface.absorb(this.#splash.surface);
      this.#splash = null;
      this.#visual = null;
      this.#mergedInto = mass;
      mass.#members.add(this);
      for (const member of this.#members) {
        member.#mergedInto = mass;
        mass.#members.add(member);
      }
      this.#members.clear();
      // Joining drops must not renew the lifetime of the older wet film.
      mass.#remaining = Math.min(mass.#remaining, this.#remaining);
      doorMasses.get(this.#door).delete(this);

      return;
    }
  }

  clear() {
    if (this.#mergedInto) {
      const primary = this.#mergedInto;
      this.#mergedInto = null;
      primary.clear();
    }
    for (const member of this.#members) {
      member.#mergedInto = null;
      member.clear();
    }
    this.#members.clear();
    if (this.#door) {
      doorMasses.get(this.#door)?.delete(this);
    }
    this.#remaining = 0;
    this.#door?.releaseJam(this);
    this.#door = null;
    this.#splash?.clear();
    this.#visual = null;
    this.#splash = null;
  }
}
