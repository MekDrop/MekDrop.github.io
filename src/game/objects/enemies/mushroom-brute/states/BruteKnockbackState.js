import { State } from "yuka";
import { BrutePursueState } from "./BrutePursueState.js";

/**
 * Ammo retains the external impulse; the clip supplies only the body reaction.
 */
export class BruteKnockbackState extends State {
  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.playClip("knockback", true);
  }

  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  execute(owner) {
    owner.stateElapsed += owner.deltaTime;
    if (owner.stateElapsed >= 0.5) {
      owner.behavior.changeTo(BrutePursueState.name);
    }
  }
}
