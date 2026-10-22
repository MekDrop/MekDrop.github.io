import { State } from "yuka";
import { BrutePursueState } from "./BrutePursueState.js";

/**
 * Recovery cannot deal a second hit.
 */
export class BruteRecoverState extends State {
  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.stop();
    owner.playClip("club_recover", true);
  }

  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  execute(owner) {
    owner.stop();
    owner.stateElapsed += owner.deltaTime;
    if (owner.stateElapsed >= 0.7) {
      owner.behavior.changeTo(BrutePursueState.name);
    }
  }
}
