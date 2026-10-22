import { State } from "yuka";
import { BruteSwingState } from "./BruteSwingState.js";

/**
 * Locked anticipation gives allies and the player a readable escape window.
 */
export class BruteWindupState extends State {
  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.stop();
    owner.faceTarget(owner.attackTarget);
    owner.playClip("club_windup", true);
  }

  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  execute(owner) {
    owner.stop();
    owner.stateElapsed += owner.deltaTime;
    if (owner.stateElapsed >= 0.65) {
      owner.behavior.changeTo(BruteSwingState.name);
    }
  }
}
