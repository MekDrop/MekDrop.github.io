import { Enemy } from "../shared/Enemy.js";
import { GremlinPursueState } from "./states/GremlinPursueState.js";
import { GremlinClimbState } from "./states/GremlinClimbState.js";
import { GremlinSabotageState } from "./states/GremlinSabotageState.js";
import { GremlinTerritorialState } from "./states/GremlinTerritorialState.js";
import { GremlinConfusedState } from "./states/GremlinConfusedState.js";
import { GremlinCarriedState } from "./states/GremlinCarriedState.js";
import { GremlinAirborneState } from "./states/GremlinAirborneState.js";
import { GremlinMissedLandingState } from "./states/GremlinMissedLandingState.js";
import { GremlinAngryState } from "./states/GremlinAngryState.js";
import { GremlinAttackState } from "./states/GremlinAttackState.js";
import { GremlinDeadState } from "./states/GremlinDeadState.js";
import { GremlinPlaybackState } from "./states/GremlinPlaybackState.js";
import { wireGremlinClips } from "./WireGremlinClips.js";
import { WIRE_GREMLIN_ANIMATION } from "./WireGremlinAnimation.js";
import { WireGremlinPreview } from "./WireGremlinPreview.js";
import { WireGremlinPlaybackCheck } from "./WireGremlinPlaybackCheck.js";
import { WireGremlinNavigation } from "./WireGremlinNavigation.js";
import { GremlinEntranceState } from "./states/GremlinEntranceState.js";
import { GremlinStunnedState } from "./states/GremlinStunnedState.js";
import { GremlinRecoveryState } from "./states/GremlinRecoveryState.js";
import { GremlinHitState } from "./states/GremlinHitState.js";
import { WireGremlinSignalTower } from "./WireGremlinSignalTower.js";
import { GremlinClimbTopState } from "./states/GremlinClimbTopState.js";
import { GremlinClingLandState } from "./states/GremlinClingLandState.js";
import { GremlinAttachState } from "./states/GremlinAttachState.js";
import { GremlinDetachState } from "./states/GremlinDetachState.js";
import { GremlinTerritorialAttackState } from "./states/GremlinTerritorialAttackState.js";
import { GremlinEntranceEndState } from "./states/GremlinEntranceEndState.js";

const CLAIMS = new WeakMap();
const STATES = [
  GremlinPursueState, GremlinClimbState, GremlinSabotageState, GremlinTerritorialState,
  GremlinConfusedState, GremlinCarriedState, GremlinAirborneState,
  GremlinMissedLandingState, GremlinAngryState, GremlinAttackState, GremlinDeadState,
  GremlinPlaybackState,
  GremlinEntranceState,
  GremlinStunnedState, GremlinRecoveryState, GremlinHitState,
  GremlinClimbTopState, GremlinClingLandState, GremlinAttachState, GremlinDetachState,
  GremlinTerritorialAttackState, GremlinEntranceEndState,
];

/**
 * Model-owned gremlin behavior using authored Tripo geometry and embedded clips.
 * A tower advertises isSabotageTower and beginSabotage(source), which must return
 * an idempotent release callback that restores its actual firing mechanism.
 * Existing signal towers use an object-owned adapter to suppress real strikes.
 */
export class WireGremlin extends Enemy {
  /**
   * @type {string}
   */
  static modelUrl = new URL("../../../models/enemies/wire-gremlin/wire-gremlin.glb", import.meta.url).href;
  /**
   * @type {string[]}
   */
  static modelUrls = [WireGremlin.modelUrl];
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #model = null;
  /**
   * @type {WireGremlinPlaybackCheck|null}
   */
  #playbackCheck = null;
  /**
   * @type {WireGremlinNavigation|null}
   */
  #navigation = null;
  /**
   * @type {import("../../architecture/door/Door.js").Door|null}
   */
  #doorTarget = null;
  /**
   * @type {WeakSet<import("../../architecture/door/Door.js").Door>}
   */
  #visitedDoors = new WeakSet();
  /**
   * @type {(() => void)|null}
   */
  #releaseSabotage = null;
  /**
   * @type {{world: {removeConstraint: Function}, constraint: object, pivot: object, ammo: {destroy: Function}}|null}
   */
  #attachment = null;
  /**
   * @type {boolean}
   */
  #retired = false;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #towerContactHandle = null;
  /**
   * @type {WeakSet<import("../shared/Enemy.js").EnemyActor>}
   */
  #reachedRoyals = new WeakSet();
  /**
   * @type {WeakMap<import("../shared/Enemy.js").EnemyActor, number>}
   */
  #excludedUntil = new WeakMap();
  /**
   * @type {string}
   */
  #resumeState = GremlinPursueState.name;
  /**
   * @type {number}
   */
  #nextEvidenceTime = 0;
  /**
   * @type {number}
   */
  #nextContactEvidenceTime = 0;
  /**
   * @type {boolean}
   */
  #completedSabotage = false;

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    // Match the production resident planner's capsule clearance for this small
    // character. Wider authored overrides remain supported by the body.
    this.radius = options.definition.radius ?? 0.22;
    this.stateElapsed = 0;
    this.target = null;
    this.royalTarget = null;
    this.attackContact = false;
    this.animationName = null;
    this.sabotageProgress = 0;
    if (this.modelLibrary) {
      this.#navigation = new WireGremlinNavigation(this);
      this.#model = this.modelLibrary.instantiate(WireGremlin.modelUrl);
      this.#model.setLocalEulerAngles(0, 180, 0);
      this.entity.addChild(this.#model);
      const tracks = this.modelLibrary.getAnimationTracks(WireGremlin.modelUrl, Object.values(WIRE_GREMLIN_ANIMATION));
      this.#model.addComponent("anim", { activate: true });
      for (const clip of wireGremlinClips) {
        this.#model.anim.addAnimationState(clip.name, tracks.get(clip.name), 1, clip.loop);
      }
      this.#model.anim.baseLayer.play(WIRE_GREMLIN_ANIMATION.IDLE);
    }
    for (const StateClass of STATES) {
      this.behavior.add(StateClass.name, new StateClass());
    }
    this.changeState(GremlinPursueState.name);
  }

  /**
   * @param {string} name
   */
  playAnimation(name) {
    if (this.animationName !== name) {
      this.#model?.anim.baseLayer.transition(name, 0.12);
    }
    this.animationName = name;
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return this.#playbackCheck?.status || `${super.testStatus}; ${this.animationName}; sabotage ${this.sabotageProgress.toFixed(1)}s${this.target?.disabled ? " disabled" : ""}`;
  }

  /**
   * @param {string|null} name
   */
  testPlayClip(name) {
    if (name === null) {
      this.changeState(GremlinPursueState.name);

      return;
    }
    this.changeState(GremlinPlaybackState.name);
    this.animationName = null;
    this.playAnimation(name);
  }

  /**
   * @param {string} name
   */
  playClip(name) {
    this.testPlayClip(name);
  }

  testVerifyClips() {
    if (this.#model) {
      this.#playbackCheck?.destroy();
      this.#playbackCheck = new WireGremlinPlaybackCheck(this, this.#model);
      this.#playbackCheck.start();
    }
  }

  async testCapturePreview() {
    this.testPlayClip(WIRE_GREMLIN_ANIMATION.IDLE);

    return WireGremlinPreview.capture(this);
  }


  /**
   * @param {string} name
   */
  changeState(name) {
    if (this.stateName !== name) {
      this.behavior.changeTo(name);
    }
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.#retired || !Number.isFinite(dt) || dt <= 0) {
      return;
    }
    this.stateElapsed += dt;
    super.update(dt);
    if (this.definition.recordEvidence && this.elapsed >= this.#nextEvidenceTime) {
      this.#nextEvidenceTime = this.elapsed + 0.25;
      const point = this.position;
      console.log(`Wire Gremlin runtime: ${JSON.stringify({
        elapsed: this.elapsed,
        state: this.stateName,
        clip: this.animationName,
        position: [point.x, point.y, point.z],
        velocity: this.entity.rigidbody?.linearVelocity.toArray(),
        goal: this.target ? "tower" : "royal",
        targetPosition: this.targetPosition(this.target ?? this.royalTarget)?.toArray(),
        royalPosition: this.targetPosition(this.royalTarget)?.toArray(),
        airborne: this.airborne,
        carried: !!this.carrier,
        attached: !!this.#attachment,
        towerDisabled: this.target?.disabled ?? false,
        sabotageProgress: this.sabotageProgress,
        timeScale: this.app.timeScale,
      })}`);
    }
  }

  onSceneReady() {
    super.onSceneReady();
    this.#towerContactHandle ??= this.entity.rigidbody.on("contact", /**
     *
     * @param {import("playcanvas").ContactResult} contact
     */
      (contact) => {
        const obstruction = contact.contacts?.find(/**
         * @param {import("playcanvas").ContactPoint} point
         */ (point) => Math.abs(point.normal.y) < 0.7);
        if (this.definition.recordEvidence && obstruction && this.elapsed >= this.#nextContactEvidenceTime) {
          this.#nextContactEvidenceTime = this.elapsed + 1;
          console.log(`Wire Gremlin contact: ${JSON.stringify({
            elapsed: this.elapsed,
            other: contact.other.name,
            position: this.position.toArray(),
            point: obstruction.point.toArray(),
            normal: obstruction.normal.toArray(),
          })}`);
        }
        if (this.airborne && this.#contactTower(contact.other)) {
          this.onLanding(contact);
        }
      });
  }

  pursue() {
    this.royalTarget = this.resolveRoyalTarget();
    if (!this.target && !this.#completedSabotage) {
      this.target = this.actors.map(WireGremlinSignalTower.forActor, WireGremlinSignalTower)
        .filter(this.#eligibleTower.bind(this))
        .sort(/**
         *
         * @param {import("../shared/Enemy.js").EnemyActor} a
         * @param {import("../shared/Enemy.js").EnemyActor} b
         */
          (a, b) => this.distanceTo(a) - this.distanceTo(b))[0] ?? null;
    }
    if (this.target) {
      if (!this.#eligibleTower(this.target)) {
        this.releaseTarget();

        return;
      }
      if (this.distanceTo(this.target) > (this.target.sabotageReach ?? 1)) {
        this.moveToward(this.#navigation?.next(this.target) ?? this.target, 1.5);

        return;
      }
      const occupant = CLAIMS.get(this.target);
      if (occupant && occupant !== this && occupant.alive) {
        this.changeState(GremlinTerritorialState.name);
      } else {
        CLAIMS.set(this.target, this);
        this.changeState(GremlinClimbState.name);
      }

      return;
    }
    if (!this.royalTarget || this.#reachedRoyals.has(this.royalTarget)) {
      this.playAnimation("idle");
      this.stop();

      return;
    }
    if (this.distanceTo(this.royalTarget) < 0.85) {
      this.attackContact = false;
      this.changeState(GremlinAttackState.name);
    } else {
      const obstruction = this.findDoorObstruction(this.royalTarget);
      if (obstruction) {
        this.#doorTarget = obstruction;
        this.changeState(GremlinEntranceState.name);

        return;
      }
      for (const actor of this.actors) {
        for (const door of actor.entranceDoors ?? []) {
          if (this.#visitedDoors.has(door) && this.distanceTo(door) < 4) {
            door.openTemporarily(2);
          }
          if (!this.#visitedDoors.has(door) && this.distanceTo(door) < 1.6) {
            this.#doorTarget = door;
            this.changeState(GremlinEntranceState.name);

            return;
          }
        }
      }
      this.playAnimation("run");
      this.moveToward(this.#navigation?.next(this.royalTarget) ?? this.royalTarget, 0.65, 0.001);
    }
  }

  /**
   * Castle-owned interior leaves are not separate registry objects. Pick their
   * real leaf geometry through the castle's existing interaction capability.
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {import("../../architecture/door/Door.js").Door|null}
   */
  findDoorObstruction(target) {
    const point = this.targetPosition(target);
    if (!point) {
      return null;
    }
    const start = this.position.clone().add(new this.pc.Vec3(0, this.height * 0.7, 0));
    const direction = point.clone().sub(start);
    direction.y = 0;
    if (direction.lengthSq() < 0.000001) {
      return null;
    }
    const end = start.clone().add(direction.normalize().mulScalar(1.8));
    let nearest = null;
    for (const actor of this.actors) {
      const hit = actor.getPointerHit?.(start, end);
      if (hit?.door && typeof hit.door.openTemporarily === "function" && hit.door.openAmount < 0.8 && (!nearest || hit.distance < nearest.distance)) {
        nearest = hit;
      }
    }

    return nearest?.door ?? null;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor & {sabotageApproachPosition?: import("playcanvas").Vec3}} actor
   * @returns {import("playcanvas").Vec3|null}
   */
  targetPosition(actor) {
    return actor?.sabotageApproachPosition ?? super.targetPosition(actor);
  }

  sabotageEntrance() {
    const door = this.#doorTarget;
    if (!door?.entity || this.distanceTo(door) > 1.8) {
      this.#doorTarget = null;
      this.changeState(GremlinPursueState.name);

      return;
    }
    if (this.stateElapsed < 0.4) {
      return;
    }
    // The real door still owns its swing animation and Ammo obstruction checks.
    // Defeat a stuck mechanism and hold its ordinary opening request for access.
    door.clearGlue?.();
    door.openTemporarily(6);
    this.#visitedDoors.add(door);
    this.#doorTarget = null;
    this.changeState(GremlinEntranceEndState.name);
  }

  climb() {
    if (!this.target?.entity || this.target.alive === false) {
      this.releaseTarget();
      this.changeState(GremlinPursueState.name);

      return;
    }
    const point = this.targetPosition(this.target);
    const top = point.y + (this.target.sabotageHeight ?? 1.5);
    const body = this.entity.rigidbody;
    if (!body) {
      return;
    }
    if (!this.#probeTower()) {
      this.moveToward(this.target, 0.65);
      if (this.stateElapsed > 5) {
        this.#excludeTarget();
        this.changeState(GremlinPursueState.name);
      }

      return;
    }
    if (this.position.y >= top - 0.1) {
      if (this.#attach()) {
        this.changeState(GremlinClimbTopState.name);
      } else {
        this.#excludeTarget();
        this.changeState(GremlinPursueState.name);
      }

      return;
    }
    if (this.stateElapsed > 5) {
      this.#excludeTarget();
      this.changeState(GremlinPursueState.name);

      return;
    }
    this.playAnimation(this.stateElapsed < 0.3 ? "climb_start" : "climb_loop");
    // Engine contact and gravity remain authoritative: this is a powered climb,
    // not position interpolation through the tower's collision geometry.
    const gravity = this.app.systems.rigidbody.gravity;
    body.applyForce(-gravity.x * body.mass, -gravity.y * body.mass, -gravity.z * body.mass);
    body.linearVelocity = new this.pc.Vec3(0, 1.1, 0);
  }

  sabotage() {
    if (!this.target?.entity || this.target.alive === false || !this.#attachment) {
      this.releaseTarget();
      this.changeState(GremlinPursueState.name);

      return;
    }
    if (this.stateElapsed < 0.4) {
      return;
    }
    if (!this.#releaseSabotage) {
      const release = this.target.beginSabotage(this);
      if (typeof release !== "function") {
        this.#excludeTarget();
        this.changeState(GremlinPursueState.name);

        return;
      }
      this.#releaseSabotage = release;
    }
    this.playAnimation("sabotage_loop");
    this.sabotageProgress += this.deltaTime;
    // Tower stays disabled only while held. Periodically resume the royal goal;
    // an already visited tower cannot monopolize the enemy indefinitely.
    if (this.sabotageProgress >= 6) {
      // Commit to the royal after one completed job. Nearby towers must not
      // continually preempt that route; a new throw starts a fresh sabotage job.
      this.#completedSabotage = true;
      this.#pauseSabotage();
      this.changeState(GremlinDetachState.name);
    }
  }

  dispute() {
    if (this.grudgesSuppressed) {
      this.stateElapsed = 0;
      this.stop();
      this.playAnimation("idle");

      return;
    }
    if (this.stateElapsed < 0.7) {
      return;
    }
    this.changeState(GremlinTerritorialAttackState.name);
  }

  territorialAttack() {
    const rival = this.target && CLAIMS.get(this.target);
    if (!this.attackContact && this.stateElapsed >= 0.35) {
      this.attackContact = true;
      if (rival?.alive && rival !== this && this.distanceTo(rival) < 1.5 && !this.suppressesRivalContact(rival)) {
        rival.receiveDamage(8, this, "territorial");
      }
    }
    if (this.stateElapsed >= 0.95) {
      this.#excludeTarget();
      this.changeState(GremlinPursueState.name);
    }
  }

  waitForClarity() {
    if (this.statuses.has("confused") || this.statuses.has("stun")) {
      return;
    }
    this.changeState(GremlinRecoveryState.name);
  }

  resumeTask() {
    this.changeState(this.#attachment && this.#completedSabotage ? GremlinDetachState.name : this.#resumeState);
  }

  attack() {
    const royal = this.royalTarget;
    if (!this.attackContact && this.stateElapsed >= 0.35) {
      this.attackContact = true;
      if (royal && royal.alive !== false && this.distanceTo(royal) < 1) {
        if (typeof royal.receiveDamage === "function") {
          royal.receiveDamage(12, this, "pliers");
        } else if (typeof royal.beginGameOver === "function") {
          royal.beginGameOver(() => this.app.root.findComponent("camera")?.entity.getPosition().clone() ?? this.position.clone());
          this.#reachedRoyals.add(royal);
          this.playAnimation("idle");
          this.stop();
          this.changeState(GremlinPursueState.name);

          return;
        }
      }
    }
    if (this.stateElapsed >= 0.95) {
      this.changeState(GremlinPursueState.name);
    }
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if (!["confused", "stun"].includes(name) || this.carrier || this.airborne) {
      return;
    }
    if (![GremlinConfusedState.name, GremlinStunnedState.name, GremlinRecoveryState.name, GremlinHitState.name].includes(this.stateName)) {
      this.#resumeState = this.#attachment ? GremlinSabotageState.name : GremlinPursueState.name;
    }
    this.#pauseSabotage();
    this.changeState(this.statuses.has("stun") ? GremlinStunnedState.name : GremlinConfusedState.name);
  }

  onDamaged() {
    if (!this.alive || this.carrier || this.airborne || this.statuses.has("stun") || this.statuses.has("confused")) {
      return;
    }
    this.#resumeState = this.#attachment ? GremlinSabotageState.name : GremlinPursueState.name;
    this.#pauseSabotage();
    this.changeState(GremlinHitState.name);
  }

  onCarried() {
    this.releaseTarget();
    this.changeState(GremlinCarriedState.name);
  }

  onLaunched() {
    this.releaseTarget();
    this.#completedSabotage = false;
    this.#excludedUntil = new WeakMap();
    this.changeState(GremlinAirborneState.name);
  }

  /**
   * @param {{other?: import("playcanvas").Entity}} contact
   */
  onLanded(contact) {
    if (this.statuses.has("confused") || this.statuses.has("stun")) {
      this.#resumeState = GremlinPursueState.name;
      this.changeState(this.statuses.has("stun") ? GremlinStunnedState.name : GremlinConfusedState.name);

      return;
    }
    const tower = this.#contactTower(contact.other);
    if (tower && !CLAIMS.get(tower)) {
      this.target = tower;
      CLAIMS.set(tower, this);
      if (this.#attach()) {
        this.changeState(GremlinClingLandState.name);

        return;
      }
      this.releaseTarget();
    }
    this.changeState(GremlinMissedLandingState.name);
  }

  onDeath() {
    this.releaseTarget();
    this.changeState(GremlinDeadState.name);
  }

  finishDetaching() {
    this.#excludeTarget(30);
    this.changeState(GremlinPursueState.name);
  }

  releaseTarget() {
    this.#pauseSabotage();
    if (this.#attachment) {
      const { world, constraint, pivot, ammo } = this.#attachment;
      world.removeConstraint(constraint);
      ammo.destroy(constraint);
      ammo.destroy(pivot);
      this.#attachment = null;
    }
    if (this.target && CLAIMS.get(this.target) === this) {
      CLAIMS.delete(this.target);
    }
    this.target = null;
    this.sabotageProgress = 0;
  }

  destroy() {
    if (this.#retired) {
      return;
    }
    this.#retired = true;
    this.#navigation?.destroy();
    this.#playbackCheck?.destroy();
    this.#towerContactHandle?.off();
    this.#towerContactHandle = null;
    this.releaseTarget();
    super.destroy();
  }

  /**
   * @param {Enemy & {isSabotageTower?: boolean, beginSabotage?: Function}} actor
   */
  #eligibleTower(actor) {
    return actor && actor !== this && actor.alive !== false && actor.isSabotageTower === true &&
      typeof actor.beginSabotage === "function" && this.distanceTo(actor) < 7 &&
      (this.#excludedUntil.get(actor) ?? 0) <= this.elapsed;
  }

  /**
   * @param {import("playcanvas").Entity} entity
   */
  #contactTower(entity) {
    for (let node = entity; node; node = node.parent) {
      const tower = this.actors.map(WireGremlinSignalTower.forActor, WireGremlinSignalTower).find(/**
       *
       * @param {import("../shared/Enemy.js").EnemyActor} actor
       */
        (actor) => actor?.entity === node && this.#eligibleTower(actor));
      if (tower) {
        return tower;
      }
    }

    return null;
  }

  /**
   * @param {number} cooldown
   */
  #excludeTarget(cooldown = 12) {
    if (this.target) {
      this.#excludedUntil.set(this.target, this.elapsed + cooldown);
    }
    this.releaseTarget();
  }

  #pauseSabotage() {
    this.#releaseSabotage?.();
    this.#releaseSabotage = null;
  }

  #attach() {
    const ammo = globalThis.Ammo;
    const world = this.app.systems.rigidbody.dynamicsWorld;
    const body = this.entity.rigidbody?.body;
    if (!ammo?.btPoint2PointConstraint || !world || !body || !this.#probeTower()) {
      return false;
    }
    this.stop();
    const pivot = new ammo.btVector3(0, 0, 0);
    const constraint = new ammo.btPoint2PointConstraint(body, pivot);
    const anchor = new ammo.btVector3(this.position.x, this.position.y, this.position.z);
    constraint.setPivotB(anchor);
    ammo.destroy(anchor);
    world.addConstraint(constraint, true);
    this.#attachment = {
      world,
      constraint,
      pivot,
      ammo,
    };

    return true;
  }

  #probeTower() {
    if (!this.target?.entity) {
      return null;
    }
    const start = this.position.clone().add(new this.pc.Vec3(0, this.height * 0.5, 0));
    const end = this.targetPosition(this.target).clone();
    end.y = start.y;
    const hit = this.app.systems.rigidbody.raycastFirst?.(start, end);
    if (!hit || Math.abs(hit.normal.y) > 0.5 || hit.point.distance(start) > this.radius + 0.25) {
      return null;
    }
    for (let entity = hit.entity; entity; entity = entity.parent) {
      if (entity === this.target.entity) {
        return hit;
      }
    }

    return null;
  }
}
