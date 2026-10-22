import { LATCH_SLUG_ANIMATION as ANIMATION } from "../LatchSlugAnimation.js";
import { State } from "yuka";
import { LatchDogState } from "./LatchDogState.js";
import { LatchPressState } from "./LatchPressState.js";

export class LatchSeekState extends State {
  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  execute(owner) {
    const royal = owner.resolveRoyalTarget();
    if (!royal) {
      owner.stop();
      owner.playClip(ANIMATION.SNIFF);

      return;
    }
    const door = owner.nearbyDoor;
    if (door && door.openAmount <= 0.001 && !door.jammed) {
      owner.doorTarget = door;
      owner.behavior.changeTo(LatchPressState.name);

      return;
    }
    if (owner.distanceTo(royal) < 1.2 || door?.openAmount > 0.001) {
      owner.behavior.changeTo(LatchDogState.name);

      return;
    }
    owner.playClip(ANIMATION.WADDLE_WALK);
    owner.moveToward(royal, 0.85);
  }
}
