import { LATCH_SLUG_ANIMATION as ANIMATION } from "../LatchSlugAnimation.js";
import { State } from "yuka";
import { LatchDogState } from "./LatchDogState.js";
import { LatchPressState } from "./LatchPressState.js";

export class LatchSeekState extends State {
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
    const companion = owner.resolvePackTarget();
    if (!companion) {
      if (owner.advanceToPack()) {
        owner.playClip(ANIMATION.WADDLE_WALK);

        return;
      }
      owner.stop();
      owner.playClip(ANIMATION.SNIFF);

      return;
    }
    if (owner.distanceTo(companion) <= 0.95 || door?.openAmount > 0.001) {
      owner.behavior.changeTo(LatchDogState.name);

      return;
    }
    owner.playClip(owner.elapsed < owner.pack.greetingUntil ? ANIMATION.ANTENNA_WAG : ANIMATION.WADDLE_WALK);
    owner.followTarget(companion, 0.85);
  }
}
