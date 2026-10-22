import { State } from "yuka";
import { BrutePursueState } from "./BrutePursueState.js";

/**
 * Recovering from a real stun does not discard a still-live anger source.
 */
export class BruteStunRecoverState extends State {
  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.playClip("recover", true);
  }

  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  execute(owner) {
    owner.stop();
    owner.stateElapsed += owner.deltaTime;
    if (owner.stateElapsed >= 0.65) {
      owner.behavior.changeTo(BrutePursueState.name);
    }
  }
}
