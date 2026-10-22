import { State } from "yuka";
import { FrostPuffPursueState } from "./FrostPuffPursueState.js";

export class FrostPuffStartledState extends State {
  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  enter(owner) {
    owner.playClip("startled_drift", true);
  }

  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  execute(owner) {
    if (!owner.statuses.has("confused")) {
      owner.behavior.changeTo(FrostPuffPursueState.name);

      return;
    }
    owner.driftAway(owner.frightSource);
  }
}
