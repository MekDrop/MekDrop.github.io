import { State } from "yuka";
import { BrutePursueState } from "./BrutePursueState.js";

/**
 * Irritation is an active reaction; external stun is a separate state.
 */
export class BruteAngerState extends State {
  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.stop();
    owner.playClip(owner.angerClip, true);
  }

  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  execute(owner) {
    owner.stop();
    owner.stateElapsed += owner.deltaTime;
    if (owner.stateElapsed >= 0.8) {
      owner.behavior.changeTo(BrutePursueState.name);
    }
  }
}
