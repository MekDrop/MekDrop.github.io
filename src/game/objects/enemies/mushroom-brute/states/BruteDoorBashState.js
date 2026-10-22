import { State } from "yuka";
import { BruteRecoverState } from "./BruteRecoverState.js";

/**
 * A closed leaf is an obstacle, never the brute's ultimate target.
 */
export class BruteDoorBashState extends State {
  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.swingRecipients.clear();
    owner.stop();
    owner.playClip("door_bash", true);
  }

  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  execute(owner) {
    owner.stop();
    const previous = owner.stateElapsed;
    owner.stateElapsed += owner.deltaTime;
    if (previous < 0.6 && owner.stateElapsed >= 0.6) {
      owner.bashDoor();
      owner.sweepClub(0.23, 0.25);
    }
    if (owner.stateElapsed >= 1.1) {
      owner.behavior.changeTo(BruteRecoverState.name);
    }
  }
}
