import { State } from "yuka";
import { FrostPuffRecoverState } from "./FrostPuffRecoverState.js";

export class FrostPuffStunnedState extends State {
  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip("stun", true);
  }

  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  execute(owner) {
    owner.stop();
    if (!owner.statuses.has("stun")) {
      owner.behavior.changeTo(FrostPuffRecoverState.name);
    }
  }
}
