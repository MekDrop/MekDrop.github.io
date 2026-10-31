import { State } from "yuka";
import { LATCH_SLUG_ANIMATION as ANIMATION } from "../LatchSlugAnimation.js";

/**
 * A committed physics leap stays alive until an actual closed-leaf impact.
 */
export class LatchLeapState extends State {
  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  enter(owner) {
    owner.stateAge = 0;
    owner.playClip(ANIMATION.LEAP_RISE);
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  execute(owner) {
    const door = owner.doorTarget;
    if (!door || door.broken || door.openAmount > 0.001 || owner.stateAge > 2) {
      owner.cancelDoorLeap();

      return;
    }
    const verticalSpeed = owner.entity.rigidbody.linearVelocity.y;
    owner.playClip(verticalSpeed > 1.2 ? ANIMATION.LEAP_RISE :
      verticalSpeed < -1.2 ? ANIMATION.LEAP_FALL : ANIMATION.LEAP_APEX);
  }
}
