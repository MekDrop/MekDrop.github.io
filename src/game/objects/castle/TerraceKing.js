import kingModelUrl from "../../models/castle/royals/king.glb?url";
import { KING_ANIMATION } from "../../enum/KingAnimation.js";
import { CastleLeisureSequence } from "./CastleLeisureSequence.js";
import { KingTerracePerformance } from "./KingTerracePerformance.js";
import { TerraceActor } from "./TerraceActor.js";

/** Owns the king model, its embedded animation player, and roof routine. */
export class TerraceKing {
  static get kind() {
    return "king";
  }

  static get modelUrl() {
    return kingModelUrl;
  }

  #actor;
  #sequence;
  #performance;
  #animationLayer;
  #animationName;
  #animationStep = "idle";
  #action;
  #performanceOrigin;
  #performanceRotation;
  #lastOffset = { x: 0, y: 0, z: 0 };
  #lastYaw = 0;

  constructor({ pc, modelLibrary, performanceSeed }) {
    this.#actor = new TerraceActor({
      pc,
      modelLibrary,
      modelUrl: kingModelUrl,
      kind: TerraceKing.kind,
    });
    this.#performance = new KingTerracePerformance(performanceSeed);
    this.#sequence = new CastleLeisureSequence(TerraceKing.kind);
    this.#setupAnimations(modelLibrary);
  }

  get entity() {
    return this.#actor.entity;
  }

  get sequence() {
    return this.#sequence;
  }

  get rightHand() {
    return this.#actor.rightHand;
  }

  get leftHand() {
    return this.#actor.leftHand;
  }

  get head() {
    return this.#actor.head;
  }

  get height() {
    return this.#actor.height;
  }

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
    this.#sequence = null;
    this.#animationLayer = null;
    this.#performanceOrigin = null;
    this.#performanceRotation = null;
  }

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
