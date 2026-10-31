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
    owner.faceTarget(owner.doorTarget);
    owner.playClip(ANIMATION.INFLATE_START);
  }

  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  execute(owner) {
    const door = owner.doorTarget;
    if (!door || door.broken || owner.distanceTo(door) > 5) {
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
    if (owner.stateAge >= 0.35) {
      if (!owner.beginDoorLeap()) {
        owner.behavior.changeTo(LatchSeekState.name);
      }
    } else {
      owner.playClip(ANIMATION.INFLATE_START);
    }
  }
}
