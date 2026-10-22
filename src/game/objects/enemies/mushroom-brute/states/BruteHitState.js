import { State } from "yuka";
import { BrutePursueState } from "./BrutePursueState.js";

/**
 * A brief damage reaction; never entered for a lethal blow or during stun.
 */
export class BruteHitState extends State {
  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.stop();
    owner.playClip("hit", true);
  }

  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  execute(owner) {
    owner.stop();
    owner.stateElapsed += owner.deltaTime;
    if (owner.stateElapsed >= 0.35) {
      owner.behavior.changeTo(BrutePursueState.name);
    }
  }
}
