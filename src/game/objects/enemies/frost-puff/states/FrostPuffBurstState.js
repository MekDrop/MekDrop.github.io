import { State } from "yuka";
import { FrostPuffPursueState } from "./FrostPuffPursueState.js";
import { FrostPuffStartledState } from "./FrostPuffStartledState.js";

export class FrostPuffBurstState extends State {
  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  enter(owner) {
    this.time = 0;
    owner.stop();
    owner.playClip(owner.landingBurst ? "land_burst" : "burst_charge", true);
    if (owner.landingBurst) {
      owner.lastBurstCount = owner.combat.burst();
    }
  }

  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  execute(owner) {
    const previous = this.time;
    this.time += owner.deltaTime;
    if (!owner.landingBurst && previous < 0.32 && this.time >= 0.32) {
      owner.playClip("burst_release", true);
      owner.lastBurstCount = owner.combat.burst();
    }
    if (this.time >= 0.8) {
      owner.behavior.changeTo(owner.statuses.has("confused") ?
        FrostPuffStartledState.name : FrostPuffPursueState.name);
    }
  }

  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  exit(owner) {
    owner.landingBurst = false;
  }
}
