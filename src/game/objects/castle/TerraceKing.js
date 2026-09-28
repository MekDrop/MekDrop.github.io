import kingModelUrl from "../../models/castle/royals/king.glb?url";
import { KING_ANIMATION } from "../../enum/KingAnimation.js";
import { KingTerracePerformance } from "./KingTerracePerformance.js";
import { TerraceActor } from "./TerraceActor.js";

/**
 * Owns the king model, its embedded animation player, and roof routine.
 */
export class TerraceKing {
  /**
   *
    * @returns {string}
   */
  static get kind() {
    return "king";
  }

  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return kingModelUrl;
  }

  /**
   *
    * @type {TerraceActor|null}
   */
  #actor;
  /**
   *
    * @type {KingTerracePerformance|null}
   */
  #performance;
  /**
   *
    * @type {import("playcanvas").AnimController|null}
   */
  #animationLayer;
  /**
   *
    * @type {string}
   */
  #animationName;
  /**
   *
    * @type {string}
   */
  #animationStep = "idle";
  /**
   *
    * @type {string}
   */
  #action;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #performanceOrigin;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #performanceRotation;
  /**
   *
    * @type {import("src/game/objects/ObjectTypes.js").Point3|null}
   */
  #lastOffset = { x: 0, y: 0, z: 0 };
  /**
   *
    * @type {number}
   */
  #lastYaw = 0;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: string, performanceSeed: number|string}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {string} options.modelLibrary
   * @param {number|string} options.performanceSeed
   */
  constructor({ pc, modelLibrary, performanceSeed }) {
    this.#actor = new TerraceActor({
      pc,
      modelLibrary,
      modelUrl: kingModelUrl,
      kind: TerraceKing.kind,
    });
    this.#performance = new KingTerracePerformance(performanceSeed);
    this.#setupAnimations(modelLibrary);
  }

  /**
   *
    * @returns {import("playcanvas").Entity}
   */
  get entity() {
    return this.#actor.entity;
  }

  /**
   *
    * @returns {number}
   */
  get rightHand() {
    return this.#actor.rightHand;
  }

  /**
   *
    * @returns {import("playcanvas").Entity|null}
   */
  get leftHand() {
    return this.#actor.leftHand;
  }

  /**
   *
    * @returns {import("playcanvas").Entity|null}
   */
  get head() {
    return this.#actor.head;
  }

  /**
   *
    * @returns {number}
   */
  get height() {
    return this.#actor.height;
  }

  /**
   *
   * @param {string} action
   * @param {number} time
   * @param {number} blend
   */
  pose(action, time = 0, blend = 1) {
    if (action !== this.#action) {
      this.#action = action;
      this.#performanceOrigin = action === "sword"
        ? this.entity.getLocalPosition().clone()
        : null;
      this.#performanceRotation = action === "sword"
        ? this.entity.getLocalEulerAngles().clone()
        : null;
      if (action !== "sword") {
        this.#lastOffset = { x: 0, y: 0, z: 0 };
        this.#lastYaw = 0;
      }
    }
    const sample = this.#performance.sample(action, time, blend);
    this.#play(sample.clip, sample.sequenceStep, action === "walk" ? 0.75 : 1);
    if (action !== "sword" || !this.#performanceOrigin) {
      return;
    }

    let offset = sample.offset;
    let yaw = sample.yaw;
    if (sample.sequenceStep === "rise") {
      offset = {
        x: this.#lastOffset.x * blend,
        y: this.#lastOffset.y * blend,
        z: this.#lastOffset.z * blend,
      };
      yaw = this.#lastYaw * blend;
    } else if (typeof sample.sequenceStep === "number") {
      this.#lastOffset = sample.offset;
      this.#lastYaw = sample.yaw;
    }
    this.entity.setLocalPosition(
      this.#performanceOrigin.x + offset.x,
      this.#performanceOrigin.y + offset.y,
      this.#performanceOrigin.z + offset.z,
    );
    this.entity.setLocalEulerAngles(
      this.#performanceRotation.x,
      this.#performanceRotation.y + yaw,
      this.#performanceRotation.z,
    );
  }

  destroy() {
    this.#actor.destroy();
    this.#actor = null;
    this.#performance = null;
    this.#animationLayer = null;
    this.#performanceOrigin = null;
    this.#performanceRotation = null;
  }

  /**
   *
   * @param {string} modelLibrary
   */
  #setupAnimations(modelLibrary) {
    const names = Object.values(KING_ANIMATION);
    const tracks = modelLibrary.getAnimationTracks(kingModelUrl, names);
    const model = this.#actor.model;
    model.addComponent("anim", { activate: true });
    for (const name of names) {
      const looping = [
        KING_ANIMATION.TERRACE_IDLE,
        KING_ANIMATION.TERRACE_WALK,
        KING_ANIMATION.SWORD_READY,
      ].includes(name);
      model.anim.addAnimationState(name, tracks.get(name), 1, looping);
    }
    this.#animationLayer = model.anim.baseLayer;
    this.#animationLayer.play(KING_ANIMATION.TERRACE_IDLE);
    this.#animationName = KING_ANIMATION.TERRACE_IDLE;
  }

  /**
   *
   * @param {string} name
   * @param {string|number} sequenceStep
   * @param {number} speed
   */
  #play(name, sequenceStep, speed) {
    this.#actor.model.anim.speed = speed;
    if (name === this.#animationName && sequenceStep === this.#animationStep) {
      return;
    }
    if (name === this.#animationName) {
      this.#animationLayer.play(name);
    } else {
      this.#animationLayer.transition(name, 0.06);
    }
    this.#animationName = name;
    this.#animationStep = sequenceStep;
  }
}
