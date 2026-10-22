import { Enemy } from "../shared/Enemy.js";
import { PitcherThrowPlanner } from "./PitcherThrowPlanner.js";
import { PitcherPursueState } from "./states/PitcherPursueState.js";
import { PitcherRecruitState } from "./states/PitcherRecruitState.js";
import { PitcherPickupState } from "./states/PitcherPickupState.js";
import { PitcherAimState } from "./states/PitcherAimState.js";
import { PitcherThrowState } from "./states/PitcherThrowState.js";
import { PitcherRecoverState } from "./states/PitcherRecoverState.js";
import { PitcherConfusedState } from "./states/PitcherConfusedState.js";
import { PitcherStunnedState } from "./states/PitcherStunnedState.js";
import { PitcherAngryState } from "./states/PitcherAngryState.js";
import { PitcherDeathState } from "./states/PitcherDeathState.js";
import { PitcherAnimationPlayback } from "./PitcherAnimationPlayback.js";
import { PitcherInspectState } from "./states/PitcherInspectState.js";
import { PitcherOgrePreview } from "./PitcherOgrePreview.js";
import { PitcherPlaybackAudit } from "./PitcherPlaybackAudit.js";
import { PitcherHitState } from "./states/PitcherHitState.js";
import { PitcherRejectState } from "./states/PitcherRejectState.js";
import { PitcherReleaseState } from "./states/PitcherReleaseState.js";
import { PitcherRoyalReachedState } from "./states/PitcherRoyalReachedState.js";

/**
 * Royal-directed transport specialist. No tower selection or normal-map spawn
 * registration. The authored-model adapter is attached after asset validation.
 */
export class PitcherOgre extends Enemy {
  /**
   * @type {string}
   */
  static modelUrl = new URL("../../../models/enemies/pitcher-ogre/pitcher-ogre.glb", import.meta.url).href;
  /**
   * @type {string[]}
   */
  static modelUrls = [PitcherOgre.modelUrl];
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #socketHandle = null;
  /**
   * @type {Map<Enemy, number>}
   */
  #passengerCooldowns = new Map();
  /**
   * @type {Set<Enemy>}
   */
  #queue = new Set();
  /**
   * @type {boolean}
   */
  #disposed = false;

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    this.radius = 0.75;
    this.height = 2.4;
    this.maxHealth = options.definition.maxHealth ?? 350;
    this.health = this.maxHealth;
    this.passenger = null;
    this.candidate = null;
    this.aimSolution = null;
    this.requestedAnimation = "idle";
    this.stateStartedAt = 0;
    this.nextPlanAt = 0;
    this.pressuredUntil = 0;
    this.carrySocket = new this.pc.Entity("Pitcher carry socket");
    this.carrySocket.setLocalPosition(1.05, 1.8, -0.5);
    this.entity.addChild(this.carrySocket);

    if (this.modelLibrary) {
      this.model = this.modelLibrary.instantiate(PitcherOgre.modelUrl);
      this.model.setLocalScale(3.4, 3.4, 3.4);
      this.model.setLocalEulerAngles(0, 180, 0);
      this.entity.addChild(this.model);
      this.animationPlayback = new PitcherAnimationPlayback(this.model, this.modelLibrary, PitcherOgre.modelUrl);
      const authoredSocket = this.model.findByName("CarrySocket");
      if (authoredSocket) {
        this.carrySocket.destroy();
        this.carrySocket = authoredSocket;
      }
    }
    this.throwPlanner = new PitcherThrowPlanner(this);
    this.playbackAudit = new PitcherPlaybackAudit(this);
    const states = [
      new PitcherPursueState(), new PitcherRecruitState(),
      new PitcherPickupState(), new PitcherAimState(), new PitcherThrowState(),
      new PitcherRecoverState(), new PitcherConfusedState(),
      new PitcherStunnedState(), new PitcherAngryState(), new PitcherDeathState(),
      new PitcherInspectState(),
      new PitcherHitState(), new PitcherRejectState(),
      new PitcherReleaseState(),
      new PitcherRoyalReachedState(),
    ];
    for (const state of states) {
      this.behavior.add(state.constructor.name, state);
    }
    this.changeState(options.definition.testInspection ? PitcherInspectState.name : PitcherPursueState.name);
  }

  /**
   * @returns {boolean}
   */
  get hasPassenger() {
    return this.passenger?.alive === true && this.passenger.carrier === this;
  }

  /**
   * @returns {boolean}
   */
  get underPressure() {
    return this.elapsed < this.pressuredUntil || this.health < this.maxHealth * 0.5;
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus}\n${this.requestedAnimation}; passenger: ${this.passenger?.enemyType ?? "none"}`;
  }

  onSceneReady() {
    super.onSceneReady();
    this.entity.rigidbody.mass = 140;
    this.#socketHandle = this.app.on("prerender", this.#syncPassenger.bind(this));
    if (this.definition.testInspection) {
      this.app.once("postrender", this.testShowClipPanel.bind(this, 1));
    }
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.#disposed || !Number.isFinite(dt) || dt <= 0) {
      return;
    }
    // Death owns cleanup; status reactions cannot resurrect its interrupted task.
    if (this.alive) {
      if (this.statuses.has("stun") && !(this.behavior.currentState instanceof PitcherStunnedState)) {
        this.changeState(PitcherStunnedState.name);
      } else if (!this.statuses.has("stun") && this.statuses.has("confused") &&
        !(this.behavior.currentState instanceof PitcherConfusedState)) {
        this.changeState(PitcherConfusedState.name);
      }
    }
    super.update(dt);
    this.animationPlayback?.update(dt);
    this.playbackAudit.update(dt);
    if (this.releaseEvidence && !this.releaseEvidence.landing && this.releasedPassenger?.grounded &&
      !this.releasedPassenger.airborne) {
      const point = this.releasedPassenger.position;
      this.releaseEvidence.landing = {
        position: [point.x, point.y, point.z],
        elapsed: this.elapsed,
      };
      console.info("PitcherOgreFlightEvidence", JSON.stringify(this.releaseEvidence));
    }
    this.#syncPassenger();
    for (const [actor, until] of this.#passengerCooldowns) {
      if (!actor.alive || until <= this.elapsed) {
        this.#passengerCooldowns.delete(actor);
      }
    }
  }

  /**
   * @param {string} state
   */
  changeState(state) {
    this.behavior.changeTo(state);
  }

  /**
   * @param {string} clip
   */
  requestAnimation(clip) {
    this.requestedAnimation = clip;
    // The 1.2-second stride covers 0.476 world metres per half-cycle.
    const speed = clip === "walk" ? 0.85 / (0.476 / 0.6) : clip === "hold_walk" ? 0.55 / (0.476 / 0.6) : 1;
    this.animationPlayback?.play(clip, speed);
  }

  /**
   * @param {string|null} clip
   */
  testPlayClip(clip) {
    if (!clip) {
      this.animationPlayback?.resume();
      this.changeState(PitcherPursueState.name);

      return;
    }
    this.changeState(PitcherInspectState.name);
    this.requestedAnimation = clip;
    this.animationPlayback?.inspect(clip);
  }

  testPlaybackAudit() {
    this.playbackAudit.start();
  }

  /**
   * @returns {boolean}
   */
  testPickupVolunteer() {
    this.animationPlayback?.resume();
    const actor = this.findPassenger();
    if (!this.pickUp(actor)) {
      return false;
    }
    this.changeState(PitcherInspectState.name);
    this.requestAnimation("hold_idle");

    return true;
  }

  testThrowPassenger() {
    this.animationPlayback?.resume();
    if (this.hasPassenger) {
      this.changeState(PitcherAimState.name);
    }
  }

  /**
   * @param {number} page
   */
  testShowClipPanel(page) {
    for (let index = 1; index <= 3; index++) {
      this.app.root.findByName(`Pitcher clips ${index}`)?.setLocalPosition(index === page ? 16 : -1000, -140, 0);
    }
  }

  async testCapturePreview() {
    this.testPlayClip("idle");
    await new Promise(this.#afterFrame.bind(this));
    this.testPreviewEvidence = await new PitcherOgrePreview(this).capture();
    console.info("PitcherOgrePreviewEvidence", JSON.stringify(this.testPreviewEvidence));
  }

  /**
   * Crown Crabs are always unwilling, including when a future generic actor
   * advertises a contradictory willingness flag.
   * @param {Enemy|null} actor
   * @returns {boolean}
   */
  isWillingPassenger(actor) {
    if (!actor || actor.enemyType === "CrownCrab") {
      return false;
    }
    if (typeof actor.isWillingToBeThrownBy === "function") {
      return actor.isWillingToBeThrownBy(this) === true;
    }
    return actor.enemyType === "Divecap" || actor.enemyType === "Doorcracker";
  }

  /**
   * @param {Enemy|null} actor
   * @returns {boolean}
   */
  canPickUp(actor) {
    if (!this.alive || this.statuses.has("confused") || this.statuses.has("stun") ||
      this.passenger || !actor?.isEnemy || actor === this || !actor.alive ||
      this.#passengerCooldowns.has(actor) || this.distanceTo(actor) > 5 ||
      typeof actor.beginCarry !== "function" || typeof actor.launch !== "function" ||
      actor.radius > 0.6 || actor.height > 1.4 ||
      !actor.entity?.rigidbody || !actor.canBeCarriedBy?.(this)) {
      return false;
    }
    return this.isWillingPassenger(actor) || (actor.enemyType === "CrownCrab" && this.underPressure);
  }

  /**
   * @returns {Enemy|null}
   */
  findPassenger() {
    let best = null;
    let bestScore = Infinity;
    this.#queue.clear();
    for (const actor of this.actors) {
      if (!this.canPickUp(actor)) {
        continue;
      }
      this.#queue.add(actor);
      const preferred = actor.enemyType === "Divecap" || actor.enemyType === "Doorcracker";
      const score = this.distanceTo(actor) + (this.isWillingPassenger(actor) ? 0 : 20) + (preferred ? 0 : 6);
      if (score < bestScore) {
        best = actor;
        bestScore = score;
      }
    }

    return best;
  }

  /**
   * Called at pickup contact; eligibility and distance must still be true.
   * @param {Enemy|null} actor
   * @returns {boolean}
   */
  pickUp(actor) {
    if (!this.canPickUp(actor) || this.distanceTo(actor) > 1.6) {
      return false;
    }
    const willing = this.isWillingPassenger(actor);
    if (!actor.beginCarry(this)) {
      return false;
    }
    this.passenger = actor;
    this.candidate = null;
    this.#queue.delete(actor);
    this.#syncPassenger();
    actor.onPickedUp?.({
      carrier: this,
      willing,
    });

    return true;
  }

  /**
   * @param {import("playcanvas").Vec3} velocity
   * @returns {boolean}
   */
  releasePassenger(velocity) {
    if (!this.hasPassenger) {
      this.passenger = null;

      return false;
    }
    const actor = this.passenger;
    this.#syncPassenger();
    const released = actor.launch({
      velocity,
      thrower: this,
    });
    if (!released) {
      return false;
    }
    const point = actor.position;
    this.releasedPassenger = actor;
    this.releaseEvidence = {
      kind: this.stateName === PitcherReleaseState.name ? "throw" : "drop",
      passenger: actor.enemyType,
      origin: [point.x, point.y, point.z],
      velocity: [velocity.x, velocity.y, velocity.z],
      elapsed: this.elapsed,
    };
    this.#passengerCooldowns.set(actor, this.elapsed + 8);
    this.passenger = null;
    this.aimSolution = null;

    return true;
  }

  /**
   * A drop is a low outward release; Ammo supplies falling and landing. Never
   * synthesize a landing callback while the passenger is still in mid-air.
   * @returns {boolean}
   */
  dropPassenger() {
    if (!this.hasPassenger) {
      this.passenger = null;

      return false;
    }
    const velocity = this.entity.right.clone().mulScalar(1.2);
    velocity.y = 0.2;

    return this.releasePassenger(velocity);
  }

  /**
   * @returns {boolean}
   */
  canBeCarriedBy() {
    return false;
  }

  /**
   * @returns {boolean}
   */
  beginCarry() {
    if (this.alive && !this.statuses.has("stun") && !this.statuses.has("confused")) {
      this.changeState(PitcherRejectState.name);
    }

    return false;
  }

  /**
   * @returns {boolean}
   */
  launch() {
    return false;
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if (name === "confused") {
      this.dropPassenger();
      this.changeState(PitcherConfusedState.name);
    } else if (name === "stun") {
      this.changeState(PitcherStunnedState.name);
    }
  }

  /**
   * @param {{amount: number}} damage
   */
  onDamaged(damage) {
    if (damage.amount > 0 && this.alive) {
      this.pressuredUntil = this.elapsed + 6;
      if (!this.statuses.has("stun") && !this.statuses.has("confused")) {
        this.changeState(PitcherHitState.name);
      }
    }
  }

  /**
   * @param {{victim: Enemy, consumer: Enemy}} event
   */
  onAllyConsumed({ victim, consumer }) {
    if (!this.alive || consumer === this ||
      (!this.#queue.has(victim) && this.candidate !== victim && this.passenger !== victim)) {
      return;
    }
    this.#queue.delete(victim);
    this.pressuredUntil = this.elapsed + 6;
    if (!this.statuses.has("stun") && !this.statuses.has("confused")) {
      this.changeState(PitcherAngryState.name);
    }
  }

  onDeath() {
    this.changeState(PitcherDeathState.name);
  }

  /**
   * @returns {import("playcanvas").Vec3}
   */
  cameraPosition() {
    return this.app.root?.findComponents("camera")[0]?.entity.getPosition() ?? this.position;
  }

  #syncPassenger() {
    if (!this.hasPassenger) {
      this.passenger = null;

      return;
    }
    this.passenger.entity.setPosition(this.carrySocket.getPosition());
    // Passenger clips own their pose. Keep the physical root upright so a
    // pitched throwing wrist cannot leave its capsule sideways after landing.
    this.passenger.entity.setRotation(this.entity.getRotation());
  }

  /**
   * @param {() => void} resolve
   */
  #afterFrame(resolve) {
    this.app.once("postrender", resolve);
  }

  destroy() {
    if (this.#disposed) {
      return;
    }
    this.dropPassenger();
    this.#disposed = true;
    this.#socketHandle?.off();
    this.#passengerCooldowns.clear();
    this.#queue.clear();
    super.destroy();
  }
}
