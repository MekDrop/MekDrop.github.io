const DEFAULT_FIXED_TIME_STEP = 1 / 120;
const DEFAULT_MAX_SUB_STEPS = 12;
const GROUND_PROBE_UP = 0.08;
const GROUND_PROBE_DOWN = 0.16;
const GROUND_NORMAL_MINIMUM = 0.35;

/** Owns the hero rigid body and all reads/writes to PlayCanvas physics. */
export class HeroPhysicsController {
  #pc;
  #app;
  #entity;
  #gravity;
  #gravityVector = null;
  #scripted = false;

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
    entity.addComponent("collision", {
      type: "capsule",
      axis: 1,
      radius,
      height,
      linearOffset: new pc.Vec3(0, height / 2, 0),
    });
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
    this.#applyGravity();
  }

  get scripted() {
    return this.#scripted;
  }

  get position() {
    const position = this.#entity.getLocalPosition();
    return { x: position.x, y: position.y, z: position.z };
  }

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

  resume(position, velocity = { x: 0, y: 0, z: 0 }) {
    if (this.#scripted) {
      this.#entity.rigidbody.type = "dynamic";
      this.#scripted = false;
      this.#applyGravity();
    }
    this.teleport(position, velocity);
  }

  teleport(position, velocity = this.velocity) {
    this.#entity.rigidbody.teleport(position.x, position.y, position.z);
    this.velocity = velocity;
  }

  surfaceAt(x, z, maximumHeight, minimumHeight = maximumHeight - 3) {
    const start = new this.#pc.Vec3(x, maximumHeight, z);
    const end = new this.#pc.Vec3(x, minimumHeight, z);
    const hits = this.#app.systems.rigidbody.raycastAll(start, end, {
      sort: true,
      filterCallback: (entity) => entity !== this.#entity,
    });
    const hit = hits.find(({ normal }) => normal?.y >= GROUND_NORMAL_MINIMUM);
    if (!hit) {
      return null;
    }
    return {
      entity: hit.entity,
      height: hit.point.y,
      normal: hit.normal.clone?.() ?? new this.#pc.Vec3(
        hit.normal.x,
        hit.normal.y,
        hit.normal.z,
      ),
      point: hit.point.clone?.() ?? new this.#pc.Vec3(
        hit.point.x,
        hit.point.y,
        hit.point.z,
      ),
    };
  }

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

  destroy() {
    const ammo = globalThis.Ammo;
    if (this.#gravityVector && ammo?.destroy) {
      ammo.destroy(this.#gravityVector);
    }
    this.#gravityVector = null;
    this.#entity = null;
    this.#app = null;
  }

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
