import { LATCH_SLUG_ANIMATION as ANIMATION } from "../LatchSlugAnimation.js";
import { State } from "yuka";
import { LatchPressState } from "./LatchPressState.js";

export class LatchDogState extends State {
  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  enter(owner) {
    owner.stateAge = 0;
    owner.playClip(ANIMATION.SIT_DOWN);
    owner.stop();
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  execute(owner) {
    const door = owner.nearbyDoor;
    if (door && door.openAmount <= 0.001 && !door.jammed) {
      owner.doorTarget = door;
      owner.behavior.changeTo(LatchPressState.name);

      return;
    }
    const royal = owner.resolveRoyalTarget();
    if (royal && owner.distanceTo(royal) > 1.1) {
      owner.playClip(ANIMATION.FOLLOW);
      owner.moveToward(royal, 0.9);
    } else {
      owner.stop();
      owner.playClip(owner.stateAge < 0.6 ? ANIMATION.SIT_DOWN : ANIMATION.SIT_LOOP);
      // Restriction only: never invokes a royal's damage or game-over API.
      owner.limitNearbyMovement(0.65);
    }
  }
}
