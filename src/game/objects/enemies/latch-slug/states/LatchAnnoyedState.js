import { State } from "yuka";
import { LATCH_SLUG_ANIMATION as ANIMATION } from "../LatchSlugAnimation.js";
import { LatchPressState } from "./LatchPressState.js";

/**
 * Survival takes priority over companions; retain the authored gate lane.
 */
export class LatchAnnoyedState extends State {
  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  execute(owner) {
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
    if (owner.advanceToPack()) {
      owner.playClip(owner.hurry.active ? ANIMATION.WADDLE_RUN : ANIMATION.WADDLE_WALK);
    } else {
      owner.stop();
      owner.playClip(ANIMATION.PANT);
    }
  }
}
