import { State } from "yuka";
import { FrostPuffPursueState } from "./FrostPuffPursueState.js";
import { FrostPuffStartledState } from "./FrostPuffStartledState.js";

export class FrostPuffHitState extends State {
  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  enter(owner) {
    this.time = 0;
    owner.stop();
    owner.playClip("hit", true);
  }

  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  execute(owner) {
    this.time += owner.deltaTime;
    if (this.time >= 0.25) {
      owner.behavior.changeTo(owner.statuses.has("confused") ?
        FrostPuffStartledState.name : FrostPuffPursueState.name);
    }
  }
}
