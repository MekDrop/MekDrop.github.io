// This configures the entire Ammo world, not just the hero. Match the 60 FPS
// simulation budget instead of doubling every body's collision/solver work.
const DEFAULT_FIXED_TIME_STEP = 1 / 60;
const DEFAULT_MAX_SUB_STEPS = 12;
const GROUND_PROBE_UP = 0.08;
const GROUND_PROBE_DOWN = 0.16;
const GROUND_NORMAL_MINIMUM = 0.35;
const SUPPORT_NORMAL_MINIMUM = 0.65;
const SUPPORT_CONTACT_HEIGHT = 0.3;
const HERO_SURFACE_IGNORE_TAG = "hero-surface-ignore";
const MOVING_SUPPORT_TAG = "hero-moving-support";
const SUPPORT_SURFACE_TAG = "hero-support-surface";
const SUPPORT_FACE_TOLERANCE = 0.025;
const HARD_LANDING_SPEED = 4.5;
const HARD_LANDING_DROP = 1.1;
const CAMERA_WALL_CLEARANCE = 0.04;

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
   * @type {number}
   */
  #height;
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
   * @type {import("playcanvas").Entity|null}
   */
  #contactSupport = null;
  /**
   * @type {boolean}
   */
  #inSupportContact = false;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #lastLandingSupport = null;
  /**
   * @type {{speed:number,drop:number}|null}
   */
  #hardLanding = null;
  /**
   * @type {{x:number,y:number,z:number}}
   */
  #incomingVelocity = {
    x: 0,
    y: 0,
    z: 0,
  };
  /**
   * @type {number}
   */
  #flightPeak = 0;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #motionHandle = null;

  /**
   * @type {number}
   */
  #localTimeScale = 1;
  /**
   * @type {{x:number,y:number,z:number}}
   */
  #pausedVelocity = {
    x: 0,
    y: 0,
    z: 0,
  };

  /**
   * @param {number} value
   */
  set localTimeScale(value) {
    const velocity = this.velocity;
    this.#localTimeScale = value;
    this.velocity = velocity;
    this.#applyGravity();
  }

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
    this.#height = height;
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
    this.#flightPeak = entity.getLocalPosition().y;
    // Post-render follows the hero's movement writes and precedes the next
    // solver step. Contact callbacks must read incoming, not resolved, speed.
    this.#motionHandle = app.on?.("postrender", this.#sampleMotion, this) ?? null;
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

    return {
      x: position.x,
      y: position.y,
      z: position.z,
    };
  }

  /**
   *
   * @returns {{x: number, y: number, z: number}}
   */
  get velocity() {
    if (this.#localTimeScale === 0) {
      return { ...this.#pausedVelocity };
    }
    const velocity = this.#entity.rigidbody?.linearVelocity;

    return velocity
      ? {
        x: velocity.x / this.#localTimeScale,
        y: velocity.y / this.#localTimeScale,
        z: velocity.z / this.#localTimeScale,
      }
      : {
        x: 0,
        y: 0,
        z: 0,
      };
  }

  /**
   * Keep the animated eyes on the body's side of walls and stair ceilings.
   * @param {{x:number,y:number,z:number}} anchor
   * @returns {{x:number,y:number,z:number}}
   */
  cameraPosition(anchor) {
    const body = this.#entity.getPosition();
    const start = new this.#pc.Vec3(body.x, body.y + this.#height / 2, body.z);
    const dx = anchor.x - start.x, dy = anchor.y - start.y, dz = anchor.z - start.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance < 0.000001) {
      return { ...anchor };
    }
    // Probe past the eyes so the near plane also stays clear of a nearby face.
    const scale = (distance + CAMERA_WALL_CLEARANCE) / distance;
    const end = new this.#pc.Vec3(start.x + dx * scale, start.y + dy * scale, start.z + dz * scale);
    const hits = this.#app.systems.rigidbody.raycastAll(start, end, {
      sort: true,
      /**
       * @param {import("playcanvas").Entity} entity
       */
      filterCallback: this.#filterCallback.bind(this),
    });
    const hit = hits[0];
    if (!hit) {
      return { ...anchor };
    }
    const travel = Math.max(0, Math.min(distance,
      Math.hypot(hit.point.x - start.x, hit.point.y - start.y, hit.point.z - start.z) - CAMERA_WALL_CLEARANCE));
    const fraction = travel / distance;

    return {
      x: start.x + dx * fraction,
      y: start.y + dy * fraction,
      z: start.z + dz * fraction,
    };
  }

  set gravity(value) {
    this.#gravity = value;
    this.#applyGravity();
  }

  set velocity(value) {
    this.#pausedVelocity = { ...value };
    if (!this.#entity?.rigidbody) {
      return;
    }
    this.#entity.rigidbody.linearVelocity = new this.#pc.Vec3(
      value.x * this.#localTimeScale,
      value.y * this.#localTimeScale,
      value.z * this.#localTimeScale,
    );
    this.#entity.rigidbody.activate();
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   * @param {{x: number, y: number, z: number}} velocity
   */
  setScripted(position, velocity = {
    x: 0,
    y: 0,
    z: 0,
  }) {
    if (!this.#scripted) {
      this.#entity.rigidbody.type = "kinematic";
      this.#scripted = true;
    }
    this.#entity.setLocalPosition(position.x, position.y, position.z);
    this.velocity = velocity;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   * @param {{x: number, y: number, z: number}} velocity
   */
  resume(position, velocity = {
    x: 0,
    y: 0,
    z: 0,
  }) {
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
    this.#flightPeak = position.y;
    this.#incomingVelocity = { ...velocity };
    this.#hardLanding = null;
    this.#supportContact = false;
    this.#inSupportContact = false;
    this.#contactSupport = null;
    this.#lastLandingSupport = null;
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
      filterCallback: this.#filterCallback2.bind(this),
    });
    const hit = hits.find(this.#isSupportHit.bind(this));
    if (!hit) {
      return null;
    }
    const movingSupport = HeroPhysicsController.#movingSupportRoot(hit.entity);

    return {
      entity: hit.entity,
      height: hit.point.y,
      normal:
        hit.normal.clone?.() ??
        new this.#pc.Vec3(hit.normal.x, hit.normal.y, hit.normal.z),
      point:
        hit.point.clone?.() ??
        new this.#pc.Vec3(hit.point.x, hit.point.y, hit.point.z),
      ...(movingSupport ? {
        movingSupport: true,
        velocity: this.#supportVelocity(movingSupport, hit.point),
      } : {}),
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

  /**
   * Use Ammo friction to hold a resting capsule on stepped supports.
   * Release grip during movement so it cannot catch on stair risers.
   * @param {boolean} idle
   */
  setSurfaceGrip(idle) {
    const friction = idle ? 2 : 0;
    if (this.#entity.rigidbody.friction !== friction) {
      this.#entity.rigidbody.friction = friction;
    }
  }

  consumeSupportContact() {
    let supported = this.#supportContact;
    const moving = this.#contactSupport && HeroPhysicsController.#movingSupportRoot(this.#contactSupport);
    if (moving && (moving.enabled === false || moving.rigidbody?.enabled === false || !moving.rigidbody?.body)) {
      supported = false;
    }
    this.#supportContact = false;
    if (!supported) {
      this.#inSupportContact = false;
      this.#contactSupport = null;
      this.#lastLandingSupport = null;
    }

    return supported;
  }

  /**
   * Consume one genuine impact, measured against the support's own motion.
   * @returns {{speed:number,drop:number}|null}
   */
  consumeHardLanding() {
    const landing = this.#hardLanding;
    this.#hardLanding = null;

    return landing;
  }

  #sampleMotion() {
    if (!this.#entity || this.#scripted) {
      return;
    }
    this.#incomingVelocity = this.velocity;
    const height = this.position.y;
    this.#flightPeak = this.#inSupportContact ? height : Math.max(this.#flightPeak, height);
  }

  destroy() {
    this.#entity?.rigidbody?.off?.("contact", this.#handleContact);
    this.#motionHandle?.off();
    this.#motionHandle = null;
    this.#hardLanding = null;
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
    if (!position || this.#scripted) {
      return;
    }
    if (result.other && !this.#filterCallback2(result.other)) {
      return;
    }
    const contact = result.contacts?.find(/**
     * @param {import("playcanvas").ContactPoint} candidate
     */
      (candidate) => {
        const point = candidate.pointOther ?? candidate.point;
        if (!(Math.abs(candidate.normal?.y) >= SUPPORT_NORMAL_MINIMUM) || !Number.isFinite(point?.y) ||
          point.y > position.y + SUPPORT_CONTACT_HEIGHT) {
          return false;
        }
        return !result.other || this.#isSupportHit({
          entity: result.other,
          normal: HeroPhysicsController.#upwardContactNormal(candidate.normal),
          point,
        });
      });
    if (!contact) {
      return;
    }
    this.#supportContact = true;
    const point = contact.pointOther ?? contact.point;
    const moving = result.other && HeroPhysicsController.#movingSupportRoot(result.other);
    const supportVelocity = moving ? this.#supportVelocity(moving, point) : new this.#pc.Vec3();
    const incoming = this.#incomingVelocity;
    const normal = HeroPhysicsController.#upwardContactNormal(contact.normal);
    const speed = Math.max(0, (supportVelocity.x - incoming.x) * normal.x +
      (supportVelocity.y - incoming.y) * normal.y +
      (supportVelocity.z - incoming.z) * normal.z);
    const drop = Math.max(0, this.#flightPeak - point.y);
    const changedSupport = result.other !== this.#contactSupport;
    if (this.#localTimeScale > 0 && (!this.#inSupportContact || changedSupport) && result.other !== this.#lastLandingSupport &&
      (speed >= HARD_LANDING_SPEED || (drop >= HARD_LANDING_DROP && speed >= 2))) {
      this.#hardLanding = {
        speed,
        drop,
      };
      this.#lastLandingSupport = result.other;
    }
    this.#contactSupport = result.other ?? null;
    this.#inSupportContact = true;
  };

  #applyGravity() {
    const body = this.#entity?.rigidbody?.body;
    const ammo = globalThis.Ammo;
    if (!body?.setGravity || !ammo?.btVector3) {
      return;
    }
    this.#gravityVector ??= new ammo.btVector3(0, this.#gravity, 0);
    // Ammo still integrates flight; local seconds scale velocity and gravity.
    this.#gravityVector.setValue(0, this.#gravity * this.#localTimeScale ** 2, 0);
    body.setGravity(this.#gravityVector);
    this.#entity.rigidbody.activate();
  }

  /**
   * PlayCanvas preserves the manifold normal's sign in reverse contact events.
   * Low foot contacts establish the supporting side, independently of body order.
   * @param {import("playcanvas").Vec3} normal
   * @returns {{x:number,y:number,z:number}}
   */
  static #upwardContactNormal(normal) {
    const sign = normal.y < 0 ? -1 : 1;

    return {
      x: normal.x * sign,
      y: normal.y * sign,
      z: normal.z * sign,
    };
  }

  /**
   * @param {import("playcanvas").Entity} entity
   */
  #filterCallback(entity) {
    for (let node = entity; node; node = node.parent) {
      if (node === this.#entity) {
        return false;
      }
    }

    return true;
  }

  /**
   *
   * @param {import("playcanvas").Entity} entity
   */
  #filterCallback2(entity) {
    for (let node = entity; node; node = node.parent) {
      if (node === this.#entity || node.tags?.has(HERO_SURFACE_IGNORE_TAG)) {
        return false;
      }
    }

    return true;
  }

  /**
   *
   * Moving compound bodies expose only their declared deck's upward face as
   * support. Rail tops and the slab's underside must never become landing pads.
   * @param {{entity: import("playcanvas").Entity, normal: import("playcanvas").Vec3, point: import("playcanvas").Vec3}} hit
   */
  #isSupportHit(hit) {
    const moving = HeroPhysicsController.#movingSupportRoot(hit.entity);
    if (!moving) {
      return hit.normal?.y >= GROUND_NORMAL_MINIMUM;
    }
    if (hit.normal?.y < SUPPORT_NORMAL_MINIMUM) {
      return false;
    }
    const surfaces = moving.findByTag(SUPPORT_SURFACE_TAG);

    return surfaces.some(/**
     * @param {import("playcanvas").Entity} surface
     */
      (surface) => {
        const half = surface.collision?.halfExtents;
        if (!half) {
          return false;
        }
        const local = surface.getWorldTransform().clone().invert().transformPoint(hit.point);

        return Math.abs(local.y - half.y) <= SUPPORT_FACE_TOLERANCE &&
          Math.abs(local.x) <= half.x + SUPPORT_FACE_TOLERANCE &&
          Math.abs(local.z) <= half.z + SUPPORT_FACE_TOLERANCE;
      });
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {import("playcanvas").Entity|null}
   */
  static #movingSupportRoot(entity) {
    for (let node = entity; node; node = node.parent) {
      if (node.tags?.has(MOVING_SUPPORT_TAG)) {
        return node;
      }
    }

    return null;
  }

  /**
   * Read the contact-point velocity of an actual dynamic body. The hero's
   * movement state can compare relative motion without teleporting the rider.
   * @param {import("playcanvas").Entity} support
   * @param {import("playcanvas").Vec3} point
   * @returns {import("playcanvas").Vec3}
   */
  #supportVelocity(support, point) {
    if (this.#localTimeScale <= 0) {
      return new this.#pc.Vec3();
    }
    const linear = support.rigidbody?.linearVelocity;
    const angular = support.rigidbody?.angularVelocity;
    const center = support.getPosition();
    const dx = point.x - center.x, dy = point.y - center.y, dz = point.z - center.z;
    const logicalScale = 1 / this.#localTimeScale;

    return new this.#pc.Vec3(
      ((linear?.x ?? 0) + (angular?.y ?? 0) * dz - (angular?.z ?? 0) * dy) * logicalScale,
      ((linear?.y ?? 0) + (angular?.z ?? 0) * dx - (angular?.x ?? 0) * dz) * logicalScale,
      ((linear?.z ?? 0) + (angular?.x ?? 0) * dy - (angular?.y ?? 0) * dx) * logicalScale,
    );
  }
}
