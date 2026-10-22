import { State } from "yuka";
import { BruteRecoverState } from "./BruteRecoverState.js";

/**
 * One contact per recipient per swing, even across many physics rays.
 */
export class BruteSwingState extends State {
  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.swingRecipients.clear();
    owner.playClip(owner.enraged ? "enraged_swing" : "club_swing", true);
  }

  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  execute(owner) {
    owner.stop();
    const previous = owner.stateElapsed;
    owner.stateElapsed += owner.deltaTime;
    // Sweep the entire crossed contact interval, including a long update.
    if (previous <= 0.36 && owner.stateElapsed >= 0.12) {
      owner.sweepClub(Math.max(previous, 0.12), Math.min(owner.stateElapsed, 0.36));
    }
    if (owner.stateElapsed >= 0.48) {
      owner.behavior.changeTo(BruteRecoverState.name);
    }
  }
}
