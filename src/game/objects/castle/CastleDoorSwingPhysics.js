/**
 * Tests candidate animated poses against the live Ammo world without moving
 * the real kinematic bodies. This keeps animation-driven doors from pushing
 * through static masonry or occupants.
 */
export class CastleDoorSwingPhysics {
  /**
   * @type {Array<{entity: import("playcanvas").Entity, half: number[]}>}
   */
  #parts;
  /**
   * @type {typeof globalThis.Ammo}
   */
  #ammo;
  /**
   * @type {import("sync-ammo").btCollisionObject|null}
   */
  #probe = null;
  /**
   * @type {import("sync-ammo").btTransform}
   */
  #transform;
  /**
   * @type {import("sync-ammo").btVector3}
   */
  #position;
  /**
   * @type {import("sync-ammo").btQuaternion}
   */
  #rotation;
  /**
   * @type {import("sync-ammo").ConcreteContactResultCallback}
   */
  #callback;
  /**
   * @type {Set<number>}
   */
  #ownBodies = new Set();
  /**
   * @type {Map<number, number>}
   */
  #contacts = new Map();

  /**
   * @param {Array<{entity: import("playcanvas").Entity, half: number[]}>} parts
   */
  constructor(parts) {
    this.#parts = parts;
    this.#ammo = globalThis.Ammo;
  }

  /**
   * Returns horizontal penetration depths by obstacle at the current visual pose.
   * Floor and ceiling support contacts do not restrict a vertical hinge.
   * @returns {Map<number, number>}
   */
  contacts() {
    const world = this.#parts[0]?.entity.rigidbody?.system?.dynamicsWorld;
    if (!world || !this.#ammo?.ConcreteContactResultCallback) {
      return new Map();
    }
    if (!this.#probe) {
      this.#initialize();
    }
    const ammo = this.#ammo;
    this.#contacts = new Map();
    this.#ownBodies.clear();
    for (const { entity } of this.#parts) {
      const body = entity.rigidbody?.body;
      if (body) this.#ownBodies.add(ammo.getPointer(body));
    }
    for (const { entity } of this.#parts) {
      const body = entity.rigidbody?.body;
      if (!body || !entity.enabled) continue;
      const position = entity.getPosition();
      const rotation = entity.getRotation();
      this.#position.setValue(position.x, position.y, position.z);
      this.#rotation.setValue(rotation.x, rotation.y, rotation.z, rotation.w);
      this.#transform.setOrigin(this.#position);
      this.#transform.setRotation(this.#rotation);
      this.#probe.setCollisionShape(body.getCollisionShape());
      this.#probe.setWorldTransform(this.#transform);
      world.contactTest(this.#probe, this.#callback);
    }
    return this.#contacts;
  }

  /**
   * Synchronizes accepted poses so subsequent doors query the current bodies.
   */
  syncBodies() {
    for (const { entity } of this.#parts) {
      entity.rigidbody?.syncEntityToBody?.();
      const body = entity.rigidbody?.body;
      if (body && this.#ammo.getPointer(body.getBroadphaseHandle())) {
        entity.rigidbody.system.dynamicsWorld?.updateSingleAabb?.(body);
      }
    }
  }

  destroy() {
    if (!this.#probe) return;
    for (const resource of [this.#callback, this.#probe, this.#transform, this.#position, this.#rotation]) {
      this.#ammo.destroy(resource);
    }
    this.#probe = null;
  }

  #initialize() {
    const ammo = this.#ammo;
    this.#probe = new ammo.btPairCachingGhostObject();
    this.#transform = new ammo.btTransform();
    this.#transform.setIdentity();
    this.#position = new ammo.btVector3();
    this.#rotation = new ammo.btQuaternion();
    this.#callback = new ammo.ConcreteContactResultCallback();
    /**
     * @param {number} pointPointer
     * @param {number} firstPointer
     * @param {number} firstPart
     * @param {number} firstIndex
     * @param {number} secondPointer
     */
    this.#callback.addSingleResult = (pointPointer, firstPointer, firstPart, firstIndex, secondPointer) => {
      const contact = ammo.wrapPointer(pointPointer, ammo.btManifoldPoint);
      const depth = -contact.getDistance();
      if (depth <= 0) return 0;
      // A vertical hinge cannot move deeper into a level floor or ceiling.
      // Ignore their support normals, including small manifold-depth variations.
      if (Math.abs(contact.get_m_normalWorldOnB().y()) > 0.999) return 0;
      const first = ammo.wrapPointer(firstPointer, ammo.btCollisionObjectWrapper).getCollisionObject();
      const second = ammo.wrapPointer(secondPointer, ammo.btCollisionObjectWrapper).getCollisionObject();
      const other = ammo.getPointer(first) === ammo.getPointer(this.#probe) ? second : first;
      const pointer = ammo.getPointer(other);
      if (this.#ownBodies.has(pointer) || (other.getCollisionFlags() & 4)) return 0;
      this.#contacts.set(pointer, Math.max(this.#contacts.get(pointer) ?? 0, depth));
      return 0;
    };
  }
}
