import { LATCH_SLUG_ANIMATION as ANIMATION } from "../LatchSlugAnimation.js";
import { State } from "yuka";
import { LatchSeekState } from "./LatchSeekState.js";

/**
 * Pickup, flight, landing, bell and stun suspend door work in a real Yuka state.
 */
export class LatchReactionState extends State {
  /**
   * @type {number|null}
   */
  #recoverAt = null;
  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  enter(owner) {
    owner.stateAge = 0;
    this.#recoverAt = null;
    owner.doorTarget = null;
    owner.stop();
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  execute(owner) {
    if (owner.carrier) {
      this.#recoverAt = null;
      owner.playClip(ANIMATION.CARRIED_READY);
    } else if (owner.airborne) {
      this.#recoverAt = null;
      const verticalSpeed = owner.entity.rigidbody.linearVelocity.y;
      owner.playClip(verticalSpeed > 1.2 ? ANIMATION.LEAP_RISE :
        verticalSpeed < -1.2 ? ANIMATION.LEAP_FALL : ANIMATION.LEAP_APEX);
    } else if (owner.statuses.has(ANIMATION.STUN)) {
      this.#recoverAt = null;
      owner.stop();
      owner.playClip(ANIMATION.STUN);
    } else if (owner.statuses.has("confused")) {
      this.#recoverAt = null;
      owner.stop();
      owner.playClip(ANIMATION.STARTLED);
    } else {
      owner.stop();
      if (owner.requestedClip === ANIMATION.LAND && owner.stateAge < 0.67) {
        return;
      }
      if (owner.requestedClip === ANIMATION.HIT && owner.stateAge < 0.4) {
        return;
      }
      if (this.#recoverAt === null) {
        this.#recoverAt = owner.stateAge;
        owner.playClip(owner.requestedClip === ANIMATION.LAND ? ANIMATION.LAND_RECOVER : ANIMATION.RECOVER);
      } else if (owner.stateAge - this.#recoverAt >= 0.67) {
        owner.behavior.changeTo(LatchSeekState.name);
      }
    }
  }
}
