import { State } from "yuka";
import { BellBugPanicState } from "./BellBugPanicState.js";
import { BellBugScratchState } from "./BellBugScratchState.js";

/**
 * Royal pursuit, with closed main doors as temporary obstacles.
 */
export class BellBugPursueState extends State {
  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  enter(owner) {
    owner.playClip("idle_nervous");
  }

  /**
   * @param {import("../BellBug.js").BellBug} owner
   */
  execute(owner) {
    if (owner.fearEvent) {
      owner.transition(BellBugPanicState.name);

      return;
    }
    const royal = owner.resolveRoyalTarget();
    if (!royal) {
      owner.stop();
      owner.playClip("idle_nervous");

      return;
    }
    owner.scratchTarget = owner.findClosedDoor(royal);
    if (owner.canScratchDoor) {
      owner.transition(BellBugScratchState.name);

      return;
    }
    owner.playClip(owner.moveToward(royal, owner.walkSpeed) ? "scuttle_walk" : "idle_nervous");
    if (owner.distanceTo(royal) < 0.7) {
      owner.stop();
      royal.beginGameOver?.(() => owner.position);
    }
  }
}
