import { State } from "yuka";
import { LATCH_SLUG_ANIMATION as ANIMATION } from "../LatchSlugAnimation.js";
import { LatchSeekState } from "./LatchSeekState.js";

/**
 * A short crouch, one native ballistic hop, and contact-driven landing recovery.
 */
export class LatchIdleHopState extends State {
  /**
   * @type {number}
   */
  #age = 0;
  /**
   * @type {boolean}
   */
  #launched = false;
  /**
   * @type {boolean}
   */
  #landed = false;

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  enter(owner) {
    this.#age = 0;
    this.#launched = false;
    this.#landed = false;
    owner.stop();
    owner.playClip(ANIMATION.IDLE_HOP_PREPARE);
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  execute(owner) {
    this.#age += owner.deltaTime;
    if (!this.#launched) {
      owner.stop();
      if (this.#age >= 0.24) {
        this.#launched = owner.launchIdleHop();
        if (!this.#launched) {
          owner.behavior.changeTo(LatchSeekState.name);
        }
      }

      return;
    }
    if (!this.#landed) {
      // Ammo and a real supporting contact, never a timer, determine landing.
      return;
    }
    owner.stop();
    if (this.#age >= 1.25) {
      owner.behavior.changeTo(LatchSeekState.name);
    } else if (this.#age >= 0.64) {
      owner.playClip(ANIMATION.LAND_RECOVER);
    }
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  land(owner) {
    this.#age = 0;
    this.#landed = true;
    owner.stop();
    owner.playClip(ANIMATION.LAND);
  }
}
