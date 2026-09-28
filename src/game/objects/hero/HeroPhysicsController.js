const DEFAULT_FIXED_TIME_STEP = 1 / 120;
const DEFAULT_MAX_SUB_STEPS = 12;
const GROUND_PROBE_UP = 0.08;
const GROUND_PROBE_DOWN = 0.16;
const GROUND_NORMAL_MINIMUM = 0.35;
const SUPPORT_NORMAL_MINIMUM = 0.65;
const SUPPORT_CONTACT_HEIGHT = 0.3;
const HERO_SURFACE_IGNORE_TAG = "hero-surface-ignore";

/**
 * Owns the hero rigid body and all reads/writes to PlayCanvas physics.
 */
export class HeroPhysicsController {
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {import("playcanvas").Application}
   */
  #app;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #gravity;
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #gravityVector = null;
  /**
   *
    * @type {boolean}
   */
  #scripted = false;
  /**
   *
    * @type {boolean}
   */
  #supportContact = false;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, entity: import("playcanvas").Entity, radius: number, height: number, gravity: number, fixedTimeStep: number}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {import("playcanvas").Entity} options.entity
   * @param {number} options.radius
   * @param {number} options.height
   * @param {number} options.gravity
   * @param {number} options.fixedTimeStep
   */
  constructor({
    pc,
    app,
    entity,
    radius,
    height,
    gravity,
    fixedTimeStep = DEFAULT_FIXED_TIME_STEP,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = entity;
    this.#gravity = gravity;
    const system = app.systems.rigidbody;
    system.fixedTimeStep = fixedTimeStep;
    system.maxSubSteps = Math.max(system.maxSubSteps, DEFAULT_MAX_SUB_STEPS);
    system.gravity?.set(0, gravity, 0);
    entity.addComponent("collision", { type: "compound" });
    const bodyCollider = new pc.Entity("Hero body collider");
    bodyCollider.setLocalPosition(0, height / 2, 0);
    bodyCollider.addComponent("collision", {
      type: "capsule",
      axis: 1,
      radius,
      height,
    });
    entity.addChild(bodyCollider);
    entity.addComponent("rigidbody", {
      type: "dynamic",
      mass: 1,
      friction: 0,
      restitution: 0,
      linearDamping: 0,
      angularDamping: 1,
      linearFactor: new pc.Vec3(1, 1, 1),
      angularFactor: new pc.Vec3(0, 0, 0),
    });
    entity.rigidbody.on?.("contact", this.#handleContact);
    this.#applyGravity();
  }

  get scripted() {
    return this.#scripted;
  }

  /**
   *
    * @returns {{x: number, y: number, z: number}}
   */
  get position() {
    const position = this.#entity.getLocalPosition();
    return { x: position.x, y: position.y, z: position.z };
  }

  /**
   *
    * @returns {{x: number, y: number, z: number}}
   */
  get velocity() {
    const velocity = this.#entity.rigidbody?.linearVelocity;
    return velocity
      ? { x: velocity.x, y: velocity.y, z: velocity.z }
      : { x: 0, y: 0, z: 0 };
  }

  set gravity(value) {
    this.#gravity = value;
    this.#applyGravity();
  }

  set velocity(value) {
    if (!this.#entity?.rigidbody) {
      return;
    }
    this.#entity.rigidbody.linearVelocity = new this.#pc.Vec3(
      value.x,
      value.y,
      value.z,
    );
    this.#entity.rigidbody.activate();
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   * @param {{x: number, y: number, z: number}} velocity
   */
  setScripted(position, velocity = { x: 0, y: 0, z: 0 }) {
    if (!this.#scripted) {
      this.#entity.rigidbody.type = "kinematic";
      this.#scripted = true;
    }
    this.#entity.setLocalPosition(position.x, position.y, position.z);
    this.#entity.rigidbody.linearVelocity = new this.#pc.Vec3(
      velocity.x,
      velocity.y,
      velocity.z,
    );
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   * @param {{x: number, y: number, z: number}} velocity
   */
  resume(position, velocity = { x: 0, y: 0, z: 0 }) {
    if (this.#scripted) {
      this.#entity.rigidbody.type = "dynamic";
      this.#scripted = false;
      this.#applyGravity();
    }
    this.teleport(position, velocity);
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   * @param {{x: number, y: number, z: number}} velocity
   */
  teleport(position, velocity = this.velocity) {
    this.#entity.rigidbody.teleport(position.x, position.y, position.z);
    this.velocity = velocity;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} maximumHeight
   * @param {number} minimumHeight
   */
  surfaceAt(x, z, maximumHeight, minimumHeight = maximumHeight - 3) {
    const start = new this.#pc.Vec3(x, maximumHeight, z);
    const end = new this.#pc.Vec3(x, minimumHeight, z);
    const hits = this.#app.systems.rigidbody.raycastAll(start, end, {
      sort: true,
      /**
       *
       * @param {import("playcanvas").Entity} entity
       */
      filterCallback: (entity) =>
        entity !== this.#entity && !entity.tags?.has(HERO_SURFACE_IGNORE_TAG),
    });
    const hit = hits.find(/**
     *
     * @param {{normal: {x: number, y: number, z: number}}} options
     * @param {{x: number, y: number, z: number}} options.normal
     */
    ({ normal }) => normal?.y >= GROUND_NORMAL_MINIMUM);
    if (!hit) {
      return null;
    }
    return {
      entity: hit.entity,
      height: hit.point.y,
      normal:
        hit.normal.clone?.() ??
        new this.#pc.Vec3(hit.normal.x, hit.normal.y, hit.normal.z),
      point:
        hit.point.clone?.() ??
        new this.#pc.Vec3(hit.point.x, hit.point.y, hit.point.z),
    };
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   */
  groundContact(position = this.position) {
    const surface = this.surfaceAt(
      position.x,
      position.z,
      position.y + GROUND_PROBE_UP,
      position.y - GROUND_PROBE_DOWN,
    );
    if (!surface) {
      return null;
    }
    return Math.abs(position.y - surface.height) <= GROUND_PROBE_DOWN
      ? surface
      : null;
  }

  consumeSupportContact() {
    const supported = this.#supportContact;
    this.#supportContact = false;
    return supported;
  }

  destroy() {
    this.#entity?.rigidbody?.off?.("contact", this.#handleContact);
    const ammo = globalThis.Ammo;
    if (this.#gravityVector && ammo?.destroy) {
      ammo.destroy(this.#gravityVector);
    }
    this.#gravityVector = null;
    this.#entity = null;
    this.#app = null;
  }

  /**
   *
   * @param {number} result
    * @type {(result: {other: import("playcanvas").Entity, contacts: Array<{normal: import("src/game/objects/ObjectTypes.js").Point3}>}) => void}
   */
  #handleContact = (result) => {
    const position = this.#entity?.getLocalPosition?.();
    if (!position) {
      return;
    }
    this.#supportContact ||= result.contacts?.some(
      /**
       *
       * @param {number} contact
       */
      (contact) =>
        contact.normal?.y >= SUPPORT_NORMAL_MINIMUM &&
        contact.point?.y <= position.y + SUPPORT_CONTACT_HEIGHT,
    );
  };

  #applyGravity() {
    const body = this.#entity?.rigidbody?.body;
    const ammo = globalThis.Ammo;
    if (!body?.setGravity || !ammo?.btVector3) {
      return;
    }
    this.#gravityVector ??= new ammo.btVector3(0, this.#gravity, 0);
    this.#gravityVector.setValue(0, this.#gravity, 0);
    body.setGravity(this.#gravityVector);
    this.#entity.rigidbody.activate();
  }
}
