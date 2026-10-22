/**
 * @typedef {{entity?: import("playcanvas").Entity, position?: import("playcanvas").Vec3, alive?: boolean, isRoyal?: boolean, beginGameOver?: Function, audienceActor?: {entity: import("playcanvas").Entity}}} EnemyActor
 */
import { NpcStateMachine } from "../../shared/NpcStateMachine.js";

/**
 * Map-owned enemy foundation. Subclasses own their Yuka states and artwork.
 * Movement and throws use the scene's Ammo body; no trajectory integration here.
 */
export class Enemy {
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #updateHandle = null;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #contactHandle = null;
  /**
   * @type {Set<string|number>}
   */
  #seenBells = new Set();
  /**
   * @type {boolean}
   */
  #destroyed = false;

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor({ pc, app, definition, runtime = {}, modelLibrary }) {
    this.pc = pc;
    this.app = app;
    this.definition = definition;
    this.runtime = runtime;
    this.modelLibrary = modelLibrary;
    this.entity = new pc.Entity(definition.id);
    const spawn = definition.position ?? {};
    this.entity.setLocalPosition(spawn.x ?? 0, spawn.y ?? 0, spawn.z ?? 0);
    this.entity.setLocalEulerAngles(0, definition.rotation ?? 0, 0);
    this.entity.tags.add("map-object", "enemy", definition.id, this.constructor.name);
    this.entity.enemy = this;
    this.isEnemy = true;
    this.enemyType = this.constructor.name;
    this.maxHealth = Number.isFinite(definition.maxHealth) ? Math.max(1, definition.maxHealth) : 100;
    this.health = this.maxHealth;
    this.statuses = new Map();
    this.behavior = new NpcStateMachine(this);
    this.deltaTime = 0;
    this.elapsed = 0;
    this.carrier = null;
    this.thrower = null;
    this.airborne = false;
    this.grounded = false;
    this.bellImmune = false;
    this.radius = definition.radius ?? 0.3;
    this.height = definition.height ?? 1;
  }

  /**
   * @returns {boolean}
   */
  get alive() {
    return !this.#destroyed && this.health > 0;
  }
  /**
   * @returns {import("playcanvas").Vec3}
   */
  get position() {
    return this.entity.getPosition();
  }
  /**
   * @returns {NpcStateMachine}
   */
  get stateMachine() {
    return this.behavior;
  }
  /**
   * @returns {string}
   */
  get stateName() {
    return this.behavior.currentState?.constructor.name ?? "";
  }
  /**
   * @returns {string}
   */
  get testStatus() {
    return `${this.enemyType}: ${this.health}/${this.maxHealth} ${this.stateName}`;
  }
  /**
   * @returns {EnemyActor[]}
   */
  get actors() {
    return [...(this.runtime.objects ?? [])];
  }

  /**
   * Resolve an actual royal actor, including its currently active visual actor.
   */
  resolveRoyalTarget() {
    const royals = this.actors.filter(/**
     *
     * @param {EnemyActor|null} actor
     */
      (actor) => actor !== this && actor.alive !== false &&
      (actor.isRoyal === true || typeof actor.beginGameOver === "function"));

    return royals.sort(/**
     *
     * @param {EnemyActor|null} a
     * @param {EnemyActor|null} b
     */
      (a, b) => this.distanceTo(a) - this.distanceTo(b))[0] ?? null;
  }

  /**
   * @param {EnemyActor} actor
   */
  targetPosition(actor) {
    return actor?.audienceActor?.entity?.getPosition() ?? actor?.entity?.getPosition() ?? actor?.position ?? null;
  }

  /**
   * @param {EnemyActor} actor
   */
  distanceTo(actor) {
    const point = this.targetPosition(actor);

    return point ? this.position.distance(point) : Infinity;
  }

  onSceneReady() {
    if (this.#updateHandle || this.#destroyed) {
      return;
    }
    const pc = this.pc;
    this.entity.addComponent("collision", { type: "compound" });
    const capsule = new pc.Entity("Enemy contact capsule");
    capsule.setLocalPosition(0, this.height / 2, 0);
    capsule.addComponent("collision", {
      type: "capsule",
      axis: 1,
      radius: this.radius,
      height: this.height,
    });
    this.entity.addChild(capsule);
    this.entity.addComponent("rigidbody", {
      type: "dynamic",
      mass: 1,
      friction: 0.4,
      restitution: 0,
      angularFactor: new pc.Vec3(0, 0, 0),
      linearDamping: 0,
    });
    this.#contactHandle = this.entity.rigidbody.on("contact", /**
     *
     * @param {import("playcanvas").ContactResult} result
     */
      (result) => {
        const supported = result.contacts?.some(/**
       *
       * @param {import("playcanvas").ContactPoint} contact
       */
          (contact) => contact.normal.y > 0.5);
        if (!supported) {
          return;
        }
        this.grounded = true;
        if (this.airborne) {
          this.onLanding({ other: result.other });
        }
      });
    this.#updateHandle = this.app.on("update", /**
     *
     * @param {number} dt
     */
      (dt) => this.update(dt));
  }

  /**
   * Subclasses may extend, but must call super.update(dt).
   * @param {number} dt
   */
  update(dt) {
    if (this.#destroyed || !Number.isFinite(dt) || dt <= 0) {
      return;
    }
    this.deltaTime = dt;
    this.elapsed += dt;
    for (const [name, status] of this.statuses) {
      status.remaining -= dt;
      if (status.remaining <= 0) {
        this.statuses.delete(name);
      }
    }
    if (this.carrier) {
      const point = this.targetPosition(this.carrier);
      if (point) {
        this.entity.setPosition(point.x, point.y + 1.1, point.z);
      }
    }
    this.behavior.update();
  }

  /**
   * Set horizontal velocity; preserve gravity and engine contact response.
   * @param {EnemyActor|null} target
   * @param {number} speed
   * @param {number} arrivalRadius
   */
  moveToward(target, speed = 1.2, arrivalRadius = 0.05) {
    const point = this.targetPosition(target);
    if (!point || !Number.isFinite(speed) || speed < 0 || !this.alive || this.carrier || this.airborne || this.statuses.has("stun")) {
      this.stop();

      return false;
    }
    const direction = new this.pc.Vec3(point.x - this.position.x, 0, point.z - this.position.z);
    const arrival = Number.isFinite(arrivalRadius) ? Math.max(0.001, arrivalRadius) : 0.05;
    if (direction.length() < arrival) {
      this.stop();

      return false;
    }
    const factor = this.statuses.get("slow")?.factor ?? 1;
    const slow = Number.isFinite(factor) ? Math.min(1, Math.max(0, factor)) : 1;
    direction.normalize().mulScalar(speed * slow);
    const body = this.entity.rigidbody;
    if (!body) {
      return false;
    }
    body.linearVelocity = new this.pc.Vec3(direction.x, body.linearVelocity.y, direction.z);
    this.entity.setEulerAngles(0, Math.atan2(-direction.x, -direction.z) * 180 / Math.PI, 0);

    return true;
  }

  stop() {
    const body = this.entity.rigidbody;
    if (body && !this.airborne) {
      body.linearVelocity = new this.pc.Vec3(0, body.linearVelocity.y, 0);
    }
  }

  /**
   * @param {number} amount
   * @param {EnemyActor|null} source
   * @param {string} kind
   * @returns {number} Applied damage.
   */
  receiveDamage(amount, source = null, kind = "physical") {
    if (!this.alive || !Number.isFinite(amount) || amount <= 0) {
      return 0;
    }
    const applied = Math.min(this.health, amount);
    this.health -= applied;
    this.onDamaged?.({
      amount: applied,
      source,
      kind,
    });
    if (!this.alive) {
      this.statuses.clear();
      this.carrier = null;
      this.stop();
      this.onDeath?.({
        source,
        kind,
      });
    }
    return applied;
  }

  /**
   * @param {number} amount
   * @returns {number}
   */
  receiveHealing(amount) {
    if (!this.alive || !Number.isFinite(amount) || amount <= 0) {
      return 0;
    }
    const healed = Math.min(this.maxHealth - this.health, amount);
    this.health += healed;

    return healed;
  }

  /**
   * Status is a name plus {duration, factor?, source?}; returns whether accepted.
   * @param {string} name
   * @param {{duration?:number,factor?:number,source?:EnemyActor}} options
   * @param {number} options.duration
   */
  applyStatus(name, { duration = 1, ...details } = {}) {
    if (!this.alive || !Number.isFinite(duration) || duration <= 0 || this.statusImmunities?.has(name)) {
      return false;
    }
    this.statuses.set(name, {
      ...details,
      remaining: Math.max(duration, this.statuses.get(name)?.remaining ?? 0),
    });
    this.onStatusApplied?.(name, details);

    return true;
  }

  /**
   * Forward the SAME eventId for secondary bell events; deduplicated per actor.
   * @param {{eventId?:string|number,secondary?:boolean,source?:EnemyActor,duration?:number}} options
   * @param {string|number} options.eventId
   * @param {boolean} options.secondary
   * @param {EnemyActor|null} options.source
   * @param {number} options.duration
   */
  onBellRung({ eventId, secondary = false, source = null, duration = 2 } = {}) {
    if (!this.alive || secondary || (eventId !== undefined && this.#seenBells.has(eventId))) {
      return false;
    }
    if (eventId !== undefined) {
      this.#seenBells.add(eventId);
      if (this.#seenBells.size > 128) {
        this.#seenBells.delete(this.#seenBells.values().next().value);
      }
    }
    if (this.bellImmune) {
      this.onBellEncouraged?.(source);

      return false;
    }
    return this.applyStatus("confused", {
      duration,
      source,
    });
  }

  /**
   * @param {EnemyActor} carrier
   * @returns {boolean}
   */
  canBeCarriedBy(carrier) {
    return this.alive && !!carrier?.entity && !this.carrier && !this.airborne;
  }

  /**
   * @param {EnemyActor} carrier
   * @returns {boolean}
   */
  beginCarry(carrier) {
    if (!this.canBeCarriedBy(carrier)) {
      return false;
    }
    this.stop();
    this.carrier = carrier;
    if (this.entity.rigidbody) {
      this.entity.rigidbody.enabled = false;
    }
    this.onCarried?.(carrier);

    return true;
  }

  /**
   * Velocity in world metres/second; Ammo owns gravity, flight and contact.
   * @param {{velocity?:{x:number,y:number,z:number},thrower?:EnemyActor}} options
   * @param {{x:number,y:number,z:number}} options.velocity
   * @param {EnemyActor|null} options.thrower
   */
  launch({ velocity, thrower = this.carrier } = {}) {
    if (!this.alive || !velocity || ![velocity.x, velocity.y, velocity.z].every(Number.isFinite) || !this.entity.rigidbody) {
      return false;
    }
    this.thrower = thrower;
    this.carrier = null;
    this.airborne = true;
    this.grounded = false;
    const body = this.entity.rigidbody;
    body.enabled = true;
    body.teleport(this.position);
    body.linearVelocity = new this.pc.Vec3(velocity.x, velocity.y, velocity.z);
    this.onLaunched?.(thrower);

    return true;
  }

  /**
   * @param {{other?: import("playcanvas").Entity}} contact
   * @returns {boolean}
   */
  onLanding(contact = {}) {
    if (!this.airborne) {
      return false;
    }
    this.airborne = false;
    this.grounded = true;
    this.onLanded?.(contact);

    return true;
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.#updateHandle?.off();
    this.#contactHandle?.off();
    this.behavior.currentState?.exit(this);
    this.statuses.clear();
    this.entity.destroy();
  }
}
