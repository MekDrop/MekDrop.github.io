import { State } from "yuka";
import { BruteStunRecoverState } from "./BruteStunRecoverState.js";

/**
 * Bell anger can be remembered during stun but cannot cancel it.
 */
export class BruteStunState extends State {
  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip("stun", true);
  }

  /**
   * @param {import("../MushroomBrute.js").MushroomBrute} owner
   */
  execute(owner) {
    owner.stop();
    if (!owner.statuses.has("stun")) {
      owner.behavior.changeTo(BruteStunRecoverState.name);
    }
  }
}
