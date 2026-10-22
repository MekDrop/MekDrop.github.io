import { State } from "yuka";
import { FrostPuffPursueState } from "./FrostPuffPursueState.js";
import { FrostPuffStartledState } from "./FrostPuffStartledState.js";

export class FrostPuffRecoverState extends State {
  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  enter(owner) {
    this.time = 0;
    owner.stop();
    owner.playClip("recover", true);
  }

  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  execute(owner) {
    this.time += owner.deltaTime;
    if (this.time >= 0.45) {
      owner.behavior.changeTo(owner.statuses.has("confused") ?
        FrostPuffStartledState.name : FrostPuffPursueState.name);
    }
  }
}
