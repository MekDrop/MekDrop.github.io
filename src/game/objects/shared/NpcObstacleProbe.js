import { CHARACTER_HEIGHT } from "../../config/character-size.js";

/**
 * Queries authored prop triangles using Ammo instead of render bounding boxes.
 */
export class NpcObstacleProbe {
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {InstanceType<typeof Ammo.btCapsuleShape>}
   */
  #shape;
  /**
   * @type {InstanceType<typeof Ammo.btRigidBody>}
   */
  #body;
  /**
   * @type {InstanceType<typeof Ammo.btTransform>}
   */
  #transform;
  /**
   * @type {InstanceType<typeof Ammo.btVector3>}
   */
  #origin;
  /**
   * @type {InstanceType<typeof Ammo.ConcreteContactResultCallback>}
   */
  #callback;
  /**
   * @type {boolean}
   */
  #blocked = false;
  /**
   * @type {Map<string, boolean>}
   */
  #samples = new Map();
  /**
   * @type {number|undefined}
   */
  #frame;
  /**
   * @type {{position:import("playcanvas").Vec3,forward:import("playcanvas").Vec3}|null}
   */
  #seatAccess;
  /**
   * @type {{x:number,y:number,z:number}}
   */
  #point;

  /**
   * @param {import("playcanvas").Application} app
   * @param {import("playcanvas").Entity|null} seatOccupant
   */
  constructor(app, seatOccupant = null) {
    this.#app = app;
    this.#seatAccess = seatOccupant ? {
      position: seatOccupant.getPosition().clone(),
      forward: seatOccupant.forward.clone().mulScalar(-1),
    } : null;
  }

  /**
   * @param {{x:number,y:number,z:number}} point
   */
  blockedAt(point) {
    const world = this.#app.systems.rigidbody?.dynamicsWorld;
    if (!world || !globalThis.Ammo?.btCollisionObject) {
      return false;
    }
    if (this.#app.frame === undefined || this.#frame !== this.#app.frame) {
      this.#samples.clear();
      this.#frame = this.#app.frame;
    }
    const key = `${point.x}:${point.y}:${point.z}`;
    if (this.#samples.has(key)) {
      return this.#samples.get(key);
    }
    if (!this.#body) {
      this.#shape = new Ammo.btCapsuleShape(0.22, CHARACTER_HEIGHT - 0.32 - 0.44);
      const inertia = new Ammo.btVector3(0, 0, 0);
      const info = new Ammo.btRigidBodyConstructionInfo(0, null, this.#shape, inertia);
      this.#body = new Ammo.btRigidBody(info);
      Ammo.destroy(info);
      Ammo.destroy(inertia);
      this.#transform = new Ammo.btTransform();
      this.#transform.setIdentity();
      this.#origin = new Ammo.btVector3(0, 0, 0);
      this.#callback = new Ammo.ConcreteContactResultCallback();
      this.#callback.addSingleResult = this.#contact.bind(this);
    }
    this.#origin.setValue(point.x, point.y + (CHARACTER_HEIGHT + 0.32) / 2, point.z);
    this.#transform.setOrigin(this.#origin);
    this.#body.setWorldTransform(this.#transform);
    this.#blocked = false;
    this.#point = point;
    world.contactTest(this.#body, this.#callback);
    this.#samples.set(key, this.#blocked);

    return this.#blocked;
  }

  /**
   * @param {number} contact
   * @param {number} first
   * @param {number} partA
   * @param {number} indexA
   * @param {number} second
   */
  #contact(contact, first, partA, indexA, second) {
    if (this.#blocked || Ammo.wrapPointer(contact, Ammo.btManifoldPoint).getDistance() >= -0.001) {
      return 0;
    }
    for (const pointer of [first, second]) {
      const wrapper = Ammo.wrapPointer(pointer, Ammo.btCollisionObjectWrapper);
      const body = Ammo.castObject(wrapper.getCollisionObject(), Ammo.btRigidBody);
      let entity = body.entity;
      // Stair ramps support a capsule; their separate rails still obstruct it.
      if (entity?.rigidbody?.type !== "static" || entity.tags.has("capsule-support")) {
        continue;
      }
      while (entity && !entity.tags.has("map-object")) {
        entity = entity.parent;
      }
      if (entity && !entity.tags.has("Castle") && !this.#seatPassage(entity)) {
        this.#blocked = true;
      }
    }

    return 0;
  }

  /**
   * The seated root starts inside its seat. Reserve only the straight stand/sit
   * approach; the back and arms remain obstacles for every other route.
   * @param {import("playcanvas").Entity} entity
   */
  #seatPassage(entity) {
    if (!entity.tags.has("Throne") || !this.#seatAccess) {
      return false;
    }
    const { position, forward } = this.#seatAccess;
    const dx = this.#point.x - position.x;
    const dz = this.#point.z - position.z;
    const along = dx * forward.x + dz * forward.z;

    return Math.abs(this.#point.y - position.y) < 0.3 && along >= -0.03 && along < 0.9 &&
      Math.abs(dx * forward.z - dz * forward.x) < 0.14;
  }

  destroy() {
    for (const resource of [this.#callback, this.#body, this.#shape, this.#transform, this.#origin]) {
      if (resource) {
        Ammo.destroy(resource);
      }
    }
    this.#body = null;
    this.#callback = null;
    this.#shape = null;
    this.#transform = null;
    this.#origin = null;
    this.#samples.clear();
  }
}
