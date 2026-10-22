import { LATCH_SLUG_ANIMATION as ANIMATION } from "../LatchSlugAnimation.js";
import { State } from "yuka";
import { LatchSeekState } from "./LatchSeekState.js";

/**
 * Pickup, flight, landing, bell and stun suspend door work in a real Yuka state.
 */
export class LatchReactionState extends State {
  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  enter(owner) {
    owner.stateAge = 0;
    owner.doorTarget = null;
    owner.stop();
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  execute(owner) {
    if (owner.carrier) {
      owner.playClip(ANIMATION.CARRIED_READY);
    } else if (owner.airborne) {
      owner.playClip(ANIMATION.AIRBORNE);
    } else if (owner.statuses.has(ANIMATION.STUN)) {
      owner.stop();
      owner.playClip(ANIMATION.STUN);
    } else if (owner.statuses.has("confused")) {
      owner.stop();
      owner.playClip(ANIMATION.STARTLED);
    } else if (owner.stateAge < 0.65) {
      owner.stop();
      owner.playClip(ANIMATION.RECOVER);
    } else {
      owner.behavior.changeTo(LatchSeekState.name);
    }
  }
}
