/**
 * Chooses a real leaf surface and hands one ballistic launch to Ammo.
 * Contact queries, rather than elapsed flight time, authorize the fatal splat.
 */
export class LatchDoorLeap {
  /**
   * @type {import("./LatchSlug.js").LatchSlug}
   */
  #owner;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #point = null;

  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    this.#owner = owner;
  }

  /**
   * @returns {boolean}
   */
  get active() {
    return this.#point !== null;
  }

  /**
   * @returns {import("playcanvas").Vec3|null}
   */
  get point() {
    return this.#point?.clone() ?? null;
  }

  /**
   * @param {import("../../architecture/door/Door.js").Door} door
   * @returns {boolean}
   */
  sees(door) {
    const owner = this.#owner;
    // Raised entries are one tile above the road. Navigation walks their
    // authored treads before committing the leap; other storeys remain excluded.
    if (Math.abs(owner.position.y - door.entity.getPosition().y) > 1.25) {
      return false;
    }
    const sample = this.#surface(door, 0.7, 0.45);
    if (!sample) {
      return false;
    }
    const physics = owner.app?.systems?.rigidbody;
    if (!physics?.raycastFirst) {
      return true;
    }
    const start = owner.position.clone().add(new owner.pc.Vec3(0, owner.height / 2, 0));
    const end = sample.point.clone().sub(sample.normal.clone().mulScalar(0.08));
    const hit = physics.raycastFirst(start, end, {
      /**
       * @param {import("playcanvas").Entity} entity
       */
      filterCallback: (entity) => entity.rigidbody?.type === "static",
    });

    return !hit || door.blocksCameraAt(hit.point.x, hit.point.y, hit.point.z, 0.08);
  }

  /**
   * @param {import("../../architecture/door/Door.js").Door} door
   * @returns {boolean}
   */
  begin(door) {
    const owner = this.#owner;
    const body = owner.entity.rigidbody;
    if (!body || !door || door.broken || door.openAmount > 0.001 ||
      owner.airborne || owner.carrier || owner.statuses.has("stun")) {
      return false;
    }
    let sample = null;
    for (let attempt = 0; attempt < 6 && !sample; attempt++) {
      sample = this.#surface(door, Math.random(), Math.random());
    }
    if (!sample) {
      return false;
    }
    this.#point = sample.point;
    const start = owner.position.clone().add(new owner.pc.Vec3(0, owner.height / 2, 0));
    const center = sample.point.clone().add(sample.normal.clone().mulScalar(owner.radius + 0.015));
    const delta = center.sub(start);
    const gravity = Math.abs(owner.app?.systems?.rigidbody?.gravity?.y ?? -9.81);
    // Reach a distinct apex, then strike while descending. A low, nearly flat
    // trajectory with a held stretched pose reads as powered flight instead.
    const apex = Math.max(start.y, start.y + delta.y) + 0.35;
    const lift = Math.sqrt(2 * gravity * (apex - start.y));
    const duration = lift / gravity + Math.sqrt(2 * (apex - start.y - delta.y) / gravity);
    // Solve only the initial velocity. Ammo integrates gravity and all contacts.
    body.linearVelocity = new owner.pc.Vec3(delta.x / duration,
      lift, delta.z / duration);
    owner.airborne = true;
    owner.grounded = false;
    owner.faceTarget({ position: sample.point });

    return true;
  }

  /**
   * @param {import("../../architecture/door/Door.js").Door} door
   * @param {number} horizontal
   * @param {number} vertical
   * @returns {{point:import("playcanvas").Vec3,normal:import("playcanvas").Vec3}|null}
   */
  #surface(door, horizontal, vertical) {
    const { pc } = this.#owner;
    const frame = door.entity;
    const width = door.clearWidth;
    const height = door.clearHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height) || height < 1.1) {
      return null;
    }
    let side = (horizontal * 2 - 1) * Math.max(0.12, width / 2 - 0.38);
    if (Math.abs(side) < 0.12) {
      side = side < 0 ? -0.12 : 0.12;
    }
    const normal = frame.forward.clone();
    if (this.#owner.position.clone().sub(frame.getPosition()).dot(normal) < 0) {
      normal.mulScalar(-1);
    }
    const altitude = 0.7 + vertical * Math.max(0, Math.min(0.8, height - 1.7));
    const center = frame.getPosition().clone().add(frame.right.clone().mulScalar(side))
      .add(new pc.Vec3(0, altitude, 0));
    const start = center.clone().add(normal.clone().mulScalar(3));
    const end = center.clone().sub(normal.clone().mulScalar(3));
    const hit = door.getHit(start, end);

    return hit ? {
      point: start.clone().lerp(start, end, hit.distance),
      normal,
    } : null;
  }

  /**
   * @param {import("playcanvas").ContactResult} result
   * @returns {boolean}
   */
  contact(result) {
    const owner = this.#owner;
    const door = owner.doorTarget;
    if (!this.active || !door || door.openAmount > 0.001 || door.broken ||
      !door.isLeafCollider(result.other)) {
      return false;
    }
    for (const contact of result.contacts ?? []) {
      const point = contact.pointOther ?? contact.point;
      if (point && Math.abs(contact.normal?.y ?? 0) < 0.65 &&
        door.blocksCameraAt(point.x, point.y, point.z, 0.08)) {
        return owner.splat(point);
      }
    }

    return false;
  }

  cancel() {
    this.#point = null;
  }
}
