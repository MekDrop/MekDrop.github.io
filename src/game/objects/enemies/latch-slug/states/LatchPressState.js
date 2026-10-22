import { LATCH_SLUG_ANIMATION as ANIMATION } from "../LatchSlugAnimation.js";
import { State } from "yuka";
import { LatchDogState } from "./LatchDogState.js";
import { LatchSeekState } from "./LatchSeekState.js";

export class LatchPressState extends State {
  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  enter(owner) {
    owner.stateAge = 0;
    owner.stop();
    owner.playClip(ANIMATION.DOOR_PRESS);
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  execute(owner) {
    const door = owner.doorTarget;
    if (!door || door.jammed || owner.distanceTo(door) > 1.4) {
      owner.doorTarget = null;
      owner.behavior.changeTo(LatchSeekState.name);

      return;
    }
    // Opening the leaf at ANY point cancels the sacrifice.
    if (door.openAmount > 0.001) {
      owner.doorTarget = null;
      owner.behavior.changeTo(LatchDogState.name);

      return;
    }
    owner.stop();
    if (owner.stateAge >= 2.4) {
      owner.splat();
    } else {
      owner.playClip(owner.stateAge < 0.6 ? ANIMATION.DOOR_PRESS : owner.stateAge < 1.2 ? ANIMATION.INFLATE_START : ANIMATION.INFLATE_LOOP);
    }
  }
}
