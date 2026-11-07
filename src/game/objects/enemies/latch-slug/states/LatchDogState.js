import { LATCH_SLUG_ANIMATION as ANIMATION } from "../LatchSlugAnimation.js";
import { State } from "yuka";
import { LatchPressState } from "./LatchPressState.js";
import { LatchSeekState } from "./LatchSeekState.js";

export class LatchDogState extends State {
  /**
   * @type {string}
   */
  #phase = ANIMATION.SIT_DOWN;
  /**
   * @type {number}
   */
  #age = 0;
  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  enter(owner) {
    owner.stateAge = 0;
    this.#phase = ANIMATION.SIT_DOWN;
    this.#age = 0;
    owner.playClip(ANIMATION.SIT_DOWN);
    owner.stop();
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  execute(owner) {
    this.#age += owner.deltaTime;
    if (owner.affection.settling && !owner.affection.nearCompanion) {
      owner.stop();
      owner.playClip(ANIMATION.SIT_LOOP);

      return;
    }
    const door = owner.nearbyDoor;
    if (door && door.openAmount <= 0.001) {
      if (owner.approachDoor(door)) {
        owner.playClip(ANIMATION.WADDLE_WALK);

        return;
      }
      owner.doorTarget = door;
      owner.behavior.changeTo(LatchPressState.name);

      return;
    }
    const companion = owner.resolvePackTarget();
    if (!companion) {
      owner.behavior.changeTo(LatchSeekState.name);

      return;
    }
    if (owner.affection.patRemaining > 0) {
      owner.stop();
      owner.faceTarget(owner.runtime.getHero?.() ?? companion);
      owner.playClip(ANIMATION.ANTENNA_WAG);

      return;
    }
    const distance = owner.distanceTo(companion);
    const sittingDistance = owner.affection.nearCompanion ? 1.6 : 1.2;
    if (this.#phase === ANIMATION.FOLLOW) {
      if (distance > sittingDistance) {
        owner.followTarget(companion, distance > 3 ? 1.35 : 0.9);
        owner.playClip(distance > 3 ? ANIMATION.WADDLE_RUN : ANIMATION.FOLLOW);

        return;
      }
      this.#setPhase(owner, ANIMATION.SIT_DOWN);
    } else if (distance > sittingDistance && this.#phase !== ANIMATION.STAND_UP) {
      this.#setPhase(owner, ANIMATION.STAND_UP);
    }
    owner.stop();
    owner.faceTarget(companion);
    if (this.#phase === ANIMATION.STAND_UP && this.#age >= 0.6) {
      this.#setPhase(owner, ANIMATION.FOLLOW);
    } else if (this.#phase === ANIMATION.SIT_DOWN && this.#age >= 0.6) {
      this.#setPhase(owner, owner.elapsed < owner.pack.greetingUntil ? ANIMATION.ANTENNA_WAG : ANIMATION.SIT_LOOP);
    } else if (this.#phase === ANIMATION.SIT_LOOP && this.#age >= 2.4) {
      this.#setPhase(owner, ANIMATION.ANTENNA_WAG);
    } else if (this.#phase === ANIMATION.ANTENNA_WAG && this.#age >= 1.2) {
      this.#setPhase(owner, ANIMATION.PANT);
    } else if (this.#phase === ANIMATION.PANT && this.#age >= 2) {
      this.#setPhase(owner, ANIMATION.SIT_LOOP);
    }
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   * @param {string} phase
   */
  #setPhase(owner, phase) {
    this.#phase = phase;
    this.#age = 0;
    owner.playClip(phase);
  }
}
