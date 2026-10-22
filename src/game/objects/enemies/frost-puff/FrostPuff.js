import { Enemy } from "../shared/Enemy.js";
import { FrostPuffCombat } from "./FrostPuffCombat.js";
import { FrostPuffShot } from "./FrostPuffShot.js";
import { FrostPuffPursueState } from "./states/FrostPuffPursueState.js";
import { FrostPuffCastState } from "./states/FrostPuffCastState.js";
import { FrostPuffBurstState } from "./states/FrostPuffBurstState.js";
import { FrostPuffStartledState } from "./states/FrostPuffStartledState.js";
import { FrostPuffStunnedState } from "./states/FrostPuffStunnedState.js";
import { FrostPuffRecoverState } from "./states/FrostPuffRecoverState.js";
import { FrostPuffCarriedState } from "./states/FrostPuffCarriedState.js";
import { FrostPuffAirborneState } from "./states/FrostPuffAirborneState.js";
import { FrostPuffHitState } from "./states/FrostPuffHitState.js";
import { FrostPuffDeathState } from "./states/FrostPuffDeathState.js";
import { FrostPuffClipTestState } from "./states/FrostPuffClipTestState.js";
import { FROST_PUFF_ANIMATION as ANIMATION } from "./FrostPuffAnimation.js";
import { FrostPuffPreview } from "./FrostPuffPreview.js";

/**
 * Floating ice creature. Its model corrections stay below the semantic Ammo
 * root; Yuka owns decisions and the physics engine owns contact and flight.
 */
export class FrostPuff extends Enemy {
  /**
   * @type {WeakSet<import("../shared/Enemy.js").EnemyActor>}
   */
  #royalReached = new WeakSet();
  /**
   * @type {boolean}
   */
  #destroyed = false;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #model = null;
  /**
   * @type {string|null}
   */
  #clip = null;

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [new URL("../../../models/enemies/frost-puff/frost-puff.glb", import.meta.url).href];
  }

  /**
   * @param {ConstructorParameters<typeof Enemy>[0]} options
   */
  constructor(options) {
    super(options);

    this.enemyType = "FrostPuff";
    this.radius = 0.4;
    this.height = 0.9;
    this.combat = new FrostPuffCombat(this);
    this.shots = new Set();
    this.nextShotAt = 0;
    this.shotTarget = null;
    this.frightSource = null;
    this.landingBurst = false;
    this.lastBurstCount = 0;
    const states = [FrostPuffPursueState, FrostPuffCastState, FrostPuffBurstState,
      FrostPuffStartledState, FrostPuffStunnedState, FrostPuffRecoverState,
      FrostPuffCarriedState, FrostPuffAirborneState, FrostPuffHitState, FrostPuffDeathState, FrostPuffClipTestState];
    for (const StateType of states) {
      this.behavior.add(StateType.name, new StateType());
    }
    this.behavior.changeTo(FrostPuffPursueState.name);
  }

  /**
   * Moving friendly residents keep their model below a fixed map root.
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   */
  targetPosition(actor) {
    return actor?.statusEntity?.getPosition() ?? super.targetPosition(actor);
  }

  /**
   * Attach only the actual authored GLB, with no fallback mesh.
   */
  onSceneReady() {
    const url = FrostPuff.modelUrls[0];
    this.#model = this.modelLibrary.instantiate(url);
    this.#model.setLocalEulerAngles(0, 180, 0);
    this.entity.addChild(this.#model);
    this.#model.addComponent("anim", { activate: true });
    const clips = this.modelLibrary.getAnimationTracks(url, Object.values(ANIMATION));
    const loops = new Set(["hover_idle", "hover_move", "startled_drift", "stun", "carry_panic", "airborne_tumble"]);
    for (const [name, track] of clips) {
      this.#model.anim.addAnimationState(name, track, 1, loops.has(name));
    }
    this.#model.anim.baseLayer.play(this.#clip ?? "hover_idle");
    super.onSceneReady();
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    const layer = this.#model?.anim?.baseLayer;
    const time = layer?.activeStateCurrentTime ?? 0;

    const state = this.stateName.replace("FrostPuff", "").replace("State", "");

    return `${this.health}/${this.maxHealth} ${this.#clip} ${time.toFixed(2)}s\n${state} frozen:${this.lastBurstCount} Y:${this.position.y.toFixed(2)}`;
  }

  /**
   * @returns {Promise<{visiblePixels: number, transparentPixels: number, margin: number}|null>}
   */
  async capturePreview() {
    this.testClip = ANIMATION.HOVER_IDLE;

    return new FrostPuffPreview(this).capture();
  }

  /**
   * @param {string|null} name
   */
  set testClip(name) {
    if (!this.alive || this.carrier || this.airborne || this.statuses.has("stun")) {
      return;
    }
    if (name === null) {
      this.behavior.changeTo(FrostPuffPursueState.name);
    } else if (Object.values(ANIMATION).includes(name)) {
      this.behavior.changeTo(FrostPuffClipTestState.name);
      this.playClip(name, true);
    }
  }

  /**
   * @param {string} name
   * @param {boolean} restart
   */
  playClip(name, restart = false) {
    if (this.#model?.anim && (name !== this.#clip || restart)) {
      this.#model.anim.baseLayer.transition(name, restart ? 0 : 0.12);
    }
    this.#clip = name;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.#destroyed || !Number.isFinite(dt) || dt <= 0) {
      return;
    }
    super.update(dt);
    if (this.alive && !this.carrier && !this.airborne) {
      this.#hover();
    }
  }

  /**
   * @param {string} name
   * @param {{source?: import("../shared/Enemy.js").EnemyActor}} details
   */
  onStatusApplied(name, details) {
    if (this.carrier || this.airborne || !this.alive) {
      return;
    }
    if (name === "stun") {
      this.behavior.changeTo(FrostPuffStunnedState.name);
    } else if (name === "confused") {
      this.frightSource = details.source;
      if (!this.statuses.has("stun")) {
        this.behavior.changeTo(FrostPuffBurstState.name);
      }
    }
  }

  /**
   * @param {{source?: import("../shared/Enemy.js").EnemyActor}} event
   */
  onDamaged(event) {
    if (this.alive && !this.carrier && !this.airborne && !this.statuses.has("stun")) {
      this.frightSource = event.source;
      this.behavior.changeTo(FrostPuffHitState.name);
    }
  }

  onDeath() {
    this.behavior.changeTo(FrostPuffDeathState.name);
  }

  onCarried() {
    this.behavior.changeTo(FrostPuffCarriedState.name);
  }

  onLaunched() {
    this.behavior.changeTo(FrostPuffAirborneState.name);
  }

  onLanded() {
    this.landingBurst = true;
    this.behavior.changeTo(FrostPuffBurstState.name);
    if (this.statuses.has("stun")) {
      this.behavior.changeTo(FrostPuffStunnedState.name);
    }
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   */
  fireFrostShot(target) {
    const shot = new FrostPuffShot(this, target);
    this.shots.add(shot);
  }

  clearShots() {
    for (const shot of this.shots) {
      shot.destroy();
    }
    this.shots.clear();
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {boolean}
   */
  hasLineOfSight(target) {
    const point = this.targetPosition(target);
    if (!point) {
      return false;
    }
    const offset = new this.pc.Vec3(0, 0.45, 0);
    const start = this.position.clone().add(offset);
    const end = new this.pc.Vec3(point.x, point.y, point.z).add(offset);
    const physics = this.app.systems?.rigidbody;
    if (!physics?.raycastFirst) {
      return false;
    }
    const result = physics.raycastFirst(start, end, { filterCallback: this.#excludeSelf.bind(this) });

    return !result || result.entity === target.entity || result.entity.isDescendantOf(target.entity);
  }

  /**
   * Local collision probes select an open heading; they cannot solve arbitrary
   * castle mazes. Full navigation still needs actual test-map acceptance.
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @param {number} speed
   */
  followOpening(target, speed) {
    const destination = this.targetPosition(target);
    if (!destination) {
      this.stop();

      return;
    }
    const origin = this.position;
    const heading = Math.atan2(destination.x - origin.x, destination.z - origin.z);
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.57, -1.57]) {
      const point = new this.pc.Vec3(origin.x + Math.sin(heading + turn) * 1.1,
        origin.y, origin.z + Math.cos(heading + turn) * 1.1);
      if (this.#clearFootprint(point)) {
        this.playClip(turn === 0 ? "hover_move" : "hover_turn");
        this.moveToward({ position: point }, speed);

        return;
      }
    }
    this.stop();
    this.playClip("hover_idle");
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor|null} source
   */
  driftAway(source) {
    const origin = this.position;
    const point = this.targetPosition(source);
    const direction = point ? new this.pc.Vec3(origin.x - point.x, 0, origin.z - point.z) :
      new this.pc.Vec3(0, 0, -1);
    if (direction.lengthSq() < 0.001) {
      direction.set(0, 0, -1);
    }
    const destination = origin.clone().add(direction.normalize().mulScalar(2));
    if (this.#clearFootprint(destination)) {
      this.moveToward({ position: destination }, 0.8);
    } else {
      this.stop();
    }
    this.playClip("startled_drift");
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} royal
   */
  reachRoyal(royal) {
    const isRoyal = royal?.isRoyal === true || typeof royal?.beginGameOver === "function";
    if (!isRoyal || this.#royalReached.has(royal)) {
      return;
    }
    this.#royalReached.add(royal);
    if (typeof royal.receiveDamage === "function") {
      royal.receiveDamage(25, this, "frost");
    } else {
      royal.beginGameOver?.(() => this.targetPosition(royal));
      royal.startGameOverPerformance?.();
    }
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {boolean}
   */
  #excludeSelf(entity) {
    return entity !== this.entity && !entity.isDescendantOf(this.entity);
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @returns {boolean}
   */
  #clearFootprint(point) {
    const physics = this.app.systems?.rigidbody;
    if (!physics?.raycastFirst) {
      return false;
    }
    for (const side of [-this.radius, 0, this.radius]) {
      const start = this.position.clone().add(new this.pc.Vec3(side, 0.45, 0));
      const end = point.clone().add(new this.pc.Vec3(side, 0.45, 0));
      if (physics.raycastFirst(start, end, { filterCallback: this.#excludeSelf.bind(this) })) {
        return false;
      }
    }

    return true;
  }

  #hover() {
    const body = this.entity.rigidbody;
    const physics = this.app.systems?.rigidbody;
    if (!body || !physics?.raycastFirst) {
      return;
    }
    const point = this.position;
    const floor = physics.raycastFirst(point.clone().add(new this.pc.Vec3(0, 0.1, 0)),
      point.clone().add(new this.pc.Vec3(0, -1.5, 0)), { filterCallback: this.#excludeSelf.bind(this) });
    if (floor?.normal.y > 0.5) {
      const error = floor.point.y + 0.35 - point.y;
      const force = -physics.gravity.y + error * 35 - body.linearVelocity.y * 10;
      body.applyForce(0, Math.max(-20, Math.min(35, force)) * body.mass, 0);
    }
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.clearShots();
    this.#model = null;
    super.destroy();
  }
}
