const doorMasses = new WeakMap();

/**
 * Independent door restraint, retained until drained or cleared.
 */
export class LatchGlue {
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
   * @type {import("./LatchSlug.js").LatchSlug|null}
   */
  #owner = null;

  /**
   * @param {import("../../architecture/door/Door.js").Door|null} door
   * @param {number|null} duration Null disables timed expiry; drainage still clears it.
   * @param {import("./LatchSlug.js").LatchSlug|null} owner
   * @param {import("playcanvas").Vec3|null} impact
   */
  constructor(door, duration = null, owner = null, impact = null) {
    this.#door = door;
    this.#owner = owner;
    this.#remaining = duration === null ? Infinity : Number.isFinite(duration) ? Math.max(0, duration) : 0;
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
   * Collider-free residue stays attached to the actual door frame.
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
   * Lowest physically reachable goo, preferring thicker points in that band.
   * @param {import("../../architecture/door/Door.js").Door} door
   * @param {import("playcanvas").Vec3} origin
   * @param {number} maxReach
   * @returns {{point:import("playcanvas").Vec3 & {gooThickness:number},mass:LatchGlue}|null}
   */
  static scrapeTarget(door, origin, maxReach) {
    if (!Number.isFinite(maxReach) || maxReach <= 0) {
      return null;
    }
    let target = null;
    for (const mass of doorMasses.get(door) ?? []) {
      if (!mass.active || !mass.#splash?.surface || mass.#visual?.enabled === false) {
        continue;
      }
      const points = mass.#splash.surface.scrapeCandidates(origin, maxReach);
      for (const point of points) {
        const hits = mass.#owner?.app.systems?.rigidbody?.raycastAll(origin, point) ?? [];
        const length = point.distance(origin);
        if (hits.some(LatchGlue.#blocksScrape.bind(null, origin, length))) {
          continue;
        }
        if (!target || Math.floor(point.y/0.08) < Math.floor(target.point.y/0.08) ||
          (Math.floor(point.y/0.08) === Math.floor(target.point.y/0.08) &&
          (point.gooThickness ?? 0) > (target.point.gooThickness ?? 0))) {
          target = {
            point,
            mass,
          };
        }
        break;
      }
    }

    return target;
  }

  /**
   * @param {import("playcanvas").Vec3} origin
   * @param {number} length
   * @param {import("playcanvas").RaycastResult} hit
   * @returns {boolean}
   */
  static #blocksScrape(origin, length, hit) {
    if (hit.entity.rigidbody?.type === "dynamic") {
      return false;
    }
    const distance = hit.point ? hit.point.distance(origin) : Number.isFinite(hit.hitFraction) ? hit.hitFraction * length : 0;

    return distance < length - 0.025;
  }

  /**
   * The controller supplies a native-ray-confirmed foot stroke on this skin.
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3} end
   * @param {number} radius
   * @param {(data: { positions: number[], material: import("playcanvas").StandardMaterial, volume: number }) => void} [onCollect]
   * @returns {number} Actual removed gel volume in world units cubed.
   */
  scrapeAt(start, end, radius, onCollect) {
    if (!this.active || !this.#splash?.surface) {
      return 0;
    }
    const removed = this.#splash.surface.scrapeAt(start, end, radius, onCollect);
    if (this.#splash.surface.drained) {
      this.clear();
    }

    return removed;
  }

  /**
   * @param {import("playcanvas").Vec3} rayStart
   * @param {import("playcanvas").Vec3} rayEnd
   * @param {typeof import("playcanvas")} pc
   * @returns {{distance:number,point:import("playcanvas").Vec3}|null}
   */
  getPointerHit(rayStart, rayEnd, pc) {
    if (!this.active || !this.#visual) {
      return null;
    }
    const meshes = (this.#splash?.surface.visibleEntity ?? this.#visual).findComponents("render").filter(/**
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
    this.#remaining = Math.max(0, this.#remaining - dt);
    if (!this.active || (this.#door && !this.#door.jammed)) {
      this.clear();

      return;
    }
    if (this.#visual && this.#door?.entity) {
      this.#visual.setPosition(this.#door.entity.getWorldTransform().transformPoint(this.#anchor));
      this.#visual.setRotation(this.#door.entity.getRotation());
      this.#splash.update(dt);
      if (this.#splash.surface.drained) {
        this.clear();

        return;
      }
      this.#joinTouchingMasses();
    }
  }

  #joinTouchingMasses() {
    for (const mass of doorMasses.get(this.#door) ?? []) {
      if (mass === this || !mass.active ||
        mass.#splash.surface.normalSign !== this.#splash.surface.normalSign ||
        !mass.#splash.surface.touches(this.#splash.surface)) {
        continue;
      }
      this.#splash.surface.merge(mass.#splash.surface);
    }
  }

  clear() {
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
