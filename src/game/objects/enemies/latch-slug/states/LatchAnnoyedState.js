import { State } from "yuka";
import { LATCH_SLUG_ANIMATION as ANIMATION } from "../LatchSlugAnimation.js";

/**
 * Survival takes priority over companions; retain the authored gate lane.
 */
export class LatchAnnoyedState extends State {
  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  execute(owner) {
    if (owner.advanceToPack()) {
      owner.playClip(owner.hurry.active ? ANIMATION.WADDLE_RUN : ANIMATION.WADDLE_WALK);
    } else {
      owner.stop();
      owner.playClip(ANIMATION.PANT);
    }
  }
}
