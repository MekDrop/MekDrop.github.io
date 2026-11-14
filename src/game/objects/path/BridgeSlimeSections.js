/**
 * Volume-preserving native compound sections deepen the bearing end of each
 * contributor. Reciprocal width/depth keeps the uniform-density center of mass
 * at the existing articulated body origin; no hidden ballast is introduced.
 */
export class BridgeSlimeSections {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {Map<import("playcanvas").Entity,{body:import("sync-ammo/dist/ammo").btRigidBody,original:import("sync-ammo/dist/ammo").btCollisionShape,compound:import("sync-ammo/dist/ammo").btCompoundShape,children:import("sync-ammo/dist/ammo").btBoxShape[]}>}
   */
  #native = new Map();
  /**
   * @type {Map<import("playcanvas").Entity,Array<{center:import("playcanvas").Vec3,halfExtents:import("playcanvas").Vec3,volume:number}>>}
   */
  #sections = new Map();

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   */
  constructor(pc, app) {
    this.#pc = pc;
    this.#app = app;
  }

  /**
   * Call with native constraints removed. The original Engine-owned box remains
   * owned by its collision component and is restored before replacement/death.
   * @param {import("playcanvas").Entity} entity
   * @param {boolean} horizontal
   * @param {number} direction
   * @param {number} demand
   * @param {number} volume
   */
  configure(entity, horizontal, direction, demand, volume) {
    this.release(entity);
    const half = entity.collision.halfExtents;
    const sections = [];
    for (let index = 0; index < 3; index++) {
      const along = (index - 1) / 3;
      const depth = 1 - direction * along * Math.min(0.45, Math.max(0, demand));
      sections.push({
        center: new this.#pc.Vec3(horizontal ? along : 0, 0, horizontal ? 0 : along),
        halfExtents: new this.#pc.Vec3(horizontal ? 1 / 6 : half.x / depth, half.y * depth, horizontal ? half.z / depth : 1 / 6),
        volume: volume / 3,
      });
    }
    this.#sections.set(entity, sections);
    const ammo = globalThis.Ammo;
    const body = entity.rigidbody.body;
    if (!direction || demand <= 0 || !ammo.btCompoundShape || !body.getCollisionShape) {
      return;
    }
    const compound = new ammo.btCompoundShape();
    const children = [];
    for (const section of sections) {
      const half = section.halfExtents;
      const size = new ammo.btVector3(half.x, half.y, half.z);
      const child = new ammo.btBoxShape(size);
      child.setMargin?.(0.005);
      ammo.destroy(size);
      const transform = new ammo.btTransform();
      transform.setIdentity();
      const center = new ammo.btVector3(section.center.x, section.center.y, section.center.z);
      transform.setOrigin(center);
      compound.addChildShape(transform, child);
      ammo.destroy(center);
      ammo.destroy(transform);
      children.push(child);
    }
    const original = body.getCollisionShape();
    this.#replaceShape(entity, compound);
    this.#native.set(entity, {
      body,
      original,
      compound,
      children,
    });
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {import("sync-ammo/dist/ammo").btCollisionShape} shape
   */
  #replaceShape(entity, shape) {
    const ammo = globalThis.Ammo;
    const body = entity.rigidbody.body;
    const world = this.#app.systems.rigidbody.dynamicsWorld;
    this.#app.fire?.("bridge-slime:before-body-change", entity, "replace");
    world.removeRigidBody(body);
    body.setCollisionShape(shape);
    const inertia = new ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(entity.rigidbody.mass, inertia);
    body.setMassProps(entity.rigidbody.mass, inertia);
    body.updateInertiaTensor();
    ammo.destroy(inertia);
    world.addRigidBody(body, entity.rigidbody.group ?? this.#pc.BODYGROUP_DYNAMIC, entity.rigidbody.mask ?? this.#pc.BODYMASK_ALL);
    body.activate();
    this.#app.fire?.("bridge-slime:after-body-change", entity);
  }

  /**
   * @param {import("playcanvas").Entity} entity
   */
  release(entity) {
    const record = this.#native.get(entity);
    if (record) {
      this.#replaceShape(entity, record.original);
      globalThis.Ammo.destroy(record.compound);
      for (const child of record.children) {
        globalThis.Ammo.destroy(child);
      }
      this.#native.delete(entity);
    }
    this.#sections.delete(entity);
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {Array<{center:import("playcanvas").Vec3,halfExtents:import("playcanvas").Vec3,volume:number}>}
   */
  localSections(entity) {
    return this.#sections.get(entity) ?? [{
      center: new this.#pc.Vec3(),
      halfExtents: entity.collision.halfExtents,
      volume: 0,
    }];
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {Array<{position:import("playcanvas").Vec3,rotation:import("playcanvas").Quat,halfExtents:import("playcanvas").Vec3,volume:number}>}
   */
  poses(entity) {
    const transform = entity.getWorldTransform();

    return this.localSections(entity).map(/**
     *
     * @param {{center:import("playcanvas").Vec3,halfExtents:import("playcanvas").Vec3,volume:number}} section
     */
      (section) => ({
        position: transform.transformPoint(section.center),
        rotation: entity.getRotation().clone(),
        halfExtents: section.halfExtents.clone(),
        volume: section.volume,
      }));
  }
}
