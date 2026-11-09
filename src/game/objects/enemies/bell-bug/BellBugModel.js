import { BellBugScoopPose } from "./BellBugScoopPose.js";
import { BELL_BUG_ANIMATION } from "./BellBugAnimation.js";
import { BellBugPursueState } from "./states/BellBugPursueState.js";
import { BellBugGroundPose } from "./BellBugGroundPose.js";
import { BellBugCalibration } from "./BellBugCalibration.js";

/**
 * Embedded clip binding on the complete imported skinned hierarchy.
 */
export class BellBugModel {
  /**
   * @type {BellBugGroundPose}
   */
  groundPose;
  /**
   * @type {import("playcanvas").Entity}
   */
  #model;
  /**
   * @type {string|null}
   */
  #current = null;
  /**
   * @type {import("./BellBug.js").BellBug}
   */
  #owner;
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #updateHandle;

  /**
   * @param {import("./BellBug.js").BellBug} owner
   * @param {string} url
   */
  constructor(owner, url) {
    this.#owner = owner;
    this.#model = owner.modelLibrary.instantiate(url);
    this.#model.setLocalScale(BellBugCalibration.scale, BellBugCalibration.scale, BellBugCalibration.scale);
    this.#model.setLocalPosition(0, BellBugCalibration.y, BellBugCalibration.z);
    // Blender -Y maps to glTF +Z; the semantic gameplay forward is -Z.
    this.#model.setLocalEulerAngles(0, BellBugCalibration.yaw, 0);
    owner.entity.addChild(this.#model);
    this.groundPose = new BellBugGroundPose(owner, this.#model);
    const names = Object.values(BELL_BUG_ANIMATION);
    const tracks = owner.modelLibrary.getAnimationTracks(url, names);
    this.#model.addComponent("anim", { activate: true });
    const loops = new Set(["idle_nervous", "scuttle_walk", "scuttle_run", "cower",
      "panic_ring_loop", "hide_loop", "door_scratch_loop", "stun", "carried_panic", "airborne_tumble"]);
    for (const name of names) {
      this.#model.anim.addAnimationState(name, tracks.get(name), 1, loops.has(name));
    }
    this.scoopPose = new BellBugScoopPose(owner, this.#model);
    owner.doorScratch.attach();
    owner.fleshScratch.blood.attach();
    this.play(owner.clip);
    this.#updateHandle = owner.app.on("update", this.#updateSpeed, this);
  }

  #updateSpeed() {
    if (this.#owner.stateName !== BellBugPursueState.name) {
      return;
    }
    const reference = this.#current === BELL_BUG_ANIMATION.SCUTTLE_WALK ? 0.16 / (14 / 30 * 0.62) :
      this.#current === BELL_BUG_ANIMATION.SCUTTLE_RUN ? 0.2 / (9 / 30 * 0.62) : null;
    if (reference) {
      const velocity = this.#owner.entity.rigidbody?.linearVelocity;
      this.speed = velocity ? Math.hypot(velocity.x, velocity.z) / (reference * BellBugCalibration.scale) : 0;
    }
  }

  /**
   * @param {string} name
   */
  play(name) {
    if (this.#current === name) {
      return;
    }
    this.#model.anim.baseLayer.transition(name, this.#current ? 0.1 : 0);
    this.#current = name;
    this.speed = 1;
  }

  /**
   * @param {number} value
   */
  set speed(value) {
    this.#model.anim.speed = Math.max(0, Math.min(4, value));
  }

  /**
   * @returns {import("playcanvas").Entity}
   */
  get model() {
    return this.#model;
  }

  /**
   * @param {string} name
   */
  restart(name) {
    this.#current = name;
    this.speed = 1;
    // Inspection can interrupt a crossfade before its previous clips retire.
    // Clear that transition before replacing the evaluator's active clips.
    this.#model.anim.baseLayer.reset();
    this.#model.anim.baseLayer.play(name);
    this.#model.anim.baseLayer.activeStateCurrentTime = 0;
    this.#model.anim.update(0);
  }

  destroy() {
    this.scoopPose.destroy();
    this.groundPose.destroy();
    this.#updateHandle.off();
    this.#model.destroy();
  }
}
