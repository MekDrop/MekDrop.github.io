/**
 * Ammo clearance query matching the crab body, including low furniture bases.
 */
export class CrownCrabObstacleProbe {
  /**
   * @param {import("./CrownCrab.js").CrownCrab} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.samples = new Map();
    this.queries = 0;
    this.contacts = 0;
  }

  /**
   * @param {import("playcanvas").Vec3} point @returns {boolean}
   */
  blockedAt(point) {
    const world = this.owner.app.systems.rigidbody?.dynamicsWorld;
    if (!world || !globalThis.Ammo?.btCollisionObject) {
      return false;
    }
    if (this.owner.app.frame === undefined || this.frame !== this.owner.app.frame) {
      this.samples.clear();
      this.frame = this.owner.app.frame;
    }
    const key = `${point.x}:${point.y}:${point.z}`;
    if (this.samples.has(key)) {
      const sample = this.samples.get(key);
      this.escape = sample.escape;

      return sample.blocked;
    }
    if (!this.body) {
      this.shape = new Ammo.btCapsuleShape(this.owner.radius + 0.04, Math.max(0, this.owner.height - 2 * this.owner.radius));
      const inertia = new Ammo.btVector3(0, 0, 0);
      const info = new Ammo.btRigidBodyConstructionInfo(0, null, this.shape, inertia);
      this.body = new Ammo.btRigidBody(info);
      Ammo.destroy(info);
      Ammo.destroy(inertia);
      this.transform = new Ammo.btTransform();
      this.transform.setIdentity();
      this.origin = new Ammo.btVector3(0, 0, 0);
      this.callback = new Ammo.ConcreteContactResultCallback();
      this.callback.addSingleResult = this.contact.bind(this);
    }
    this.floorY = point.y;
    this.origin.setValue(point.x, point.y + this.owner.height / 2, point.z);
    this.transform.setOrigin(this.origin);
    this.body.setWorldTransform(this.transform);
    this.blocked = false;
    this.escape = null;
    this.lastObstacle = null;
    this.queries++;
    world.contactTest(this.body, this.callback);
    this.samples.set(key, {
      blocked: this.blocked,
      escape: this.escape,
    });

    return this.blocked;
  }

  /**
   * @param {number} contact
   * @param {number} first
   * @param {number} partA
   * @param {number} indexA
   * @param {number} second
   * @returns {number}
   */
  contact(contact, first, partA, indexA, second) {
    this.contacts++;
    const point = Ammo.wrapPointer(contact, Ammo.btManifoldPoint);
    if (this.blocked || point.getDistance() >= -0.001) {
      return 0;
    }
    // Query the complete rounded foot, but do not classify its supporting floor
    // as an obstacle. Overhead surfaces and horizontal contacts still block it.
    if (point.getPositionWorldOnB().y() <= this.floorY + 0.05 && Math.abs(point.get_m_normalWorldOnB().y()) > 0.65) {
      return 0;
    }
    for (const pointer of [first, second]) {
      const wrapper = Ammo.wrapPointer(pointer, Ammo.btCollisionObjectWrapper);
      const body = Ammo.castObject(wrapper.getCollisionObject(), Ammo.btRigidBody);
      let entity = body.entity;
      if (!["static", "kinematic"].includes(entity?.rigidbody?.type) || entity.tags.has("capsule-support")) {
        continue;
      }
      let closedLeaf = false;
      while (entity && !entity.tags.has("map-object")) {
        closedLeaf ||= !!entity.anim && entity.anim.baseLayer.activeStateProgress < 0.8;
        entity = entity.parent;
      }
      // Claw contact opens closed leaves. Open leaves, masonry and furniture
      // remain real obstacles, including low collision columns.
      if (entity && (!entity.tags.has("Castle") || !closedLeaf)) {
        this.blocked = true;
        const query = Ammo.wrapPointer(first, Ammo.btCollisionObjectWrapper).getCollisionObject();
        const sign = Ammo.getPointer(query) === Ammo.getPointer(this.body) ? 1 : -1;
        const normal = point.get_m_normalWorldOnB();
        this.escape = new this.owner.pc.Vec3(normal.x() * sign, 0, normal.z() * sign).normalize();
      }
    }

    return 0;
  }

  destroy() {
    for (const resource of [this.callback, this.body, this.shape, this.transform, this.origin]) {
      if (resource) {
        Ammo.destroy(resource);
      }
    }
    this.body = null;
    this.callback = null;
    this.shape = null;
    this.transform = null;
    this.origin = null;
    this.samples.clear();
  }

  /**
   * @returns {{ready:boolean,ammo:boolean,queries:number,contacts:number}}
   */
  get diagnostics() {
    return {
      ready: !!this.owner.app.systems.rigidbody?.dynamicsWorld,
      ammo: !!globalThis.Ammo?.btCollisionObject,
      queries: this.queries,
      contacts: this.contacts,
    };
  }
}
