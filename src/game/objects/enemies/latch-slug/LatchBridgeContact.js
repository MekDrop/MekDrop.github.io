/**
 * A real contact can hold a worker on a steep living front while it inflates.
 * Local anchors follow native translation/rotation without moving either body.
 */
export class LatchBridgeContact {
  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").Entity} other
   * @param {import("playcanvas").Vec3} point
   * @param {boolean} [surfacePivot]
   */
  constructor(owner, other, point, surfacePivot = false) {
    this.owner = owner;
    this.other = other;
    this.anchor = other.getWorldTransform().clone().invert().transformPoint(point);
    const root = other.getWorldTransform().clone().invert().transformPoint(owner.position);
    this.rootOffset = root.sub(this.anchor);
    this.extension = owner.position.clone().mulScalar(0);
    if (surfacePivot) {
      this.rootOffset.mulScalar(0);
      this.extension.copy(owner.entity.getWorldTransform().clone().invert().transformPoint(point));
    }
    this.constraint = null;
    this.handles = [];
    this.replacing = false;
    this.#bindNative();
    if (this.constraint) {
      this.handles.push(owner.app.on("bridge-slime:before-body-change", this.beforeBodyChange, this));
      this.handles.push(owner.app.on("bridge-slime:after-body-change", this.afterBodyChange, this));
      this.handles.push(owner.app.systems.rigidbody.on("beforeremove", this.beforeBodyChange, this));
    }
  }

  #bindNative() {
    const owner = this.owner;
    const other = this.other;
    const ammo = globalThis.Ammo;
    const world = owner.app.systems.rigidbody.dynamicsWorld;
    if (!ammo?.btPoint2PointConstraint || !world || !owner.entity.rigidbody.body || !other.rigidbody?.body) {
      return;
    }
    const anchor = this.anchor.clone().add(this.rootOffset);
    // Ammo's exposed API cannot clear an existing pair manifold. Refresh the
    // same native body's broadphase registration before admitting the sticky
    // constraint, otherwise its cached old support contact can pin the capsule
    // against the new joint anchor. No simulation or transform write occurs.
    if (world.removeRigidBody && world.addRigidBody) {
      const body = owner.entity.rigidbody;
      world.removeRigidBody(body.body);
      world.addRigidBody(body.body, body.group ?? 1, body.mask ?? 65535);
    }
    const first = new ammo.btVector3(this.extension.x, this.extension.y, this.extension.z);
    const second = new ammo.btVector3(anchor.x, anchor.y, anchor.z);
    this.constraint = new ammo.btPoint2PointConstraint(owner.entity.rigidbody.body,
      other.rigidbody.body, first, second);
    ammo.destroy(first);
    ammo.destroy(second);
    world.addConstraint(this.constraint, true);
  }

  /**
   * @returns {import("playcanvas").Vec3|null}
   */
  get point() {
    return this.constraint ? this.other.getWorldTransform().transformPoint(this.anchor) : null;
  }

  /**
   * Advance only the native joint's local anchor along the contacted support.
   * The solver carries the worker; this never writes an entity transform.
   * @param {import("playcanvas").Vec3} target
   * @param {number} deltaTime
   * @returns {boolean}
   */
  crawl(target, deltaTime) {
    if (!this.constraint) {
      return false;
    }
    const currentRoot = this.other.getWorldTransform().transformPoint(this.anchor.clone().add(this.rootOffset));
    currentRoot.sub(this.owner.entity.getWorldTransform().transformVector(this.extension));
    if (currentRoot.distance(this.owner.position) > 0.45) {
      return false;
    }
    const local = this.other.getWorldTransform().clone().invert().transformPoint(target);
    const delta = local.clone().sub(this.anchor);
    const distance = delta.length();
    if (distance > 0.001) {
      this.anchor.add(delta.mulScalar(Math.min(distance, 0.05, Math.max(0, deltaTime) * 0.45) / distance));
    }
    const pivot = this.anchor.clone().add(this.rootOffset);
    const ammo = globalThis.Ammo;
    const native = new ammo.btVector3(pivot.x, pivot.y, pivot.z);
    this.constraint.setPivotB(native);
    this.owner.entity.rigidbody.body.activate(true);
    this.other.rigidbody.body.activate(true);
    ammo.destroy(native);

    return true;
  }

  /**
   * Shift the source-side grip within the real capsule to lean into the next
   * physically adjacent section. The predecessor stays attached throughout;
   * only a real new manifold can transfer the grip to the next body.
   * @param {import("playcanvas").Vec3} target
   * @param {number} deltaTime
   */
  extend(target, deltaTime) {
    if (!this.constraint) {
      return;
    }
    const owner = this.owner;
    const local = owner.entity.getWorldTransform().clone().invert().transformPoint(target);
    local.mulScalar(-1);
    local.y += owner.height / 2;
    const center = local.clone().set(0, owner.height / 2, 0);
    const offset = local.sub(center);
    const radius = owner.radius * 0.8;
    if (offset.length() > radius) {
      offset.normalize().mulScalar(radius);
    }
    const desired = center.add(offset);
    const delta = desired.sub(this.extension);
    const distance = delta.length();
    if (distance > 0.001) {
      this.extension.add(delta.mulScalar(Math.min(distance, 0.02, Math.max(0, deltaTime) * 0.3) / distance));
    }
    const ammo = globalThis.Ammo;
    const pivot = new ammo.btVector3(this.extension.x, this.extension.y, this.extension.z);
    this.constraint.setPivotA(pivot);
    this.owner.entity.rigidbody.body.activate(true);
    this.other.rigidbody.body.activate(true);
    ammo.destroy(pivot);
  }

  /**
   * Roll an existing actual surface grip within the capsule's real volume.
   * Used to bring the capsule's bottom onto a verified bank lip.
   * @param {import("playcanvas").Vec3} target
   * @param {number} deltaTime
   */
  roll(target, deltaTime) {
    if (!this.constraint) {
      return;
    }
    const delta = target.clone().sub(this.extension);
    const distance = delta.length();
    if (distance > 0.001) {
      this.extension.add(delta.mulScalar(Math.min(distance, 0.02, Math.max(0, deltaTime) * 0.22) / distance));
    }
    const ammo = globalThis.Ammo;
    const pivot = new ammo.btVector3(this.extension.x, this.extension.y, this.extension.z);
    this.constraint.setPivotA(pivot);
    this.owner.entity.rigidbody.body.activate(true);
    this.other.rigidbody.body.activate(true);
    ammo.destroy(pivot);
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {string} [reason]
   */
  beforeBodyChange(entity, reason) {
    if (entity === this.other && reason === "replace") {
      this.#removeNative();
      this.replacing = true;

      return;
    }
    if (entity === this.other || entity === this.owner.entity) {
      this.destroy();
    }
  }

  /**
   * Preserve the existing verified attachment across a synchronous collider
   * replacement, before another native simulation step can drop the donor.
   * @param {import("playcanvas").Entity} entity
   */
  afterBodyChange(entity) {
    if (entity === this.other && this.replacing) {
      this.replacing = false;
      this.#bindNative();
    }
  }

  #removeNative() {
    if (this.constraint) {
      this.owner.app.systems.rigidbody.dynamicsWorld.removeConstraint(this.constraint);
      globalThis.Ammo.destroy(this.constraint);
      this.constraint = null;
    }
  }

  destroy() {
    this.replacing = false;
    this.#removeNative();
    for (const handle of this.handles) {
      handle.off();
    }
    this.handles.length = 0;
  }
}
