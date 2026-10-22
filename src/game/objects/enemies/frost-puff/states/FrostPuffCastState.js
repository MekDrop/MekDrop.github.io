import { State } from "yuka";
import { FrostPuffPursueState } from "./FrostPuffPursueState.js";

export class FrostPuffCastState extends State {
  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  enter(owner) {
    this.time = 0;
    owner.stop();
    owner.playClip("frost_windup", true);
  }

  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  execute(owner) {
    if (owner.suppressesRivalContact(owner.shotTarget)) {
      owner.behavior.changeTo(FrostPuffPursueState.name);

      return;
    }
    const previous = this.time;
    this.time += owner.deltaTime;
    if (previous < 0.4 && this.time >= 0.4) {
      owner.playClip("frost_cast", true);
      const target = owner.shotTarget;
      if (owner.combat.canChill(target) && owner.distanceTo(target) <= 4.5 && owner.hasLineOfSight(target)) {
        owner.fireFrostShot(target);
      }
      owner.nextShotAt = owner.elapsed + 2.2;
    }
    if (previous < 0.62 && this.time >= 0.62) {
      owner.playClip("frost_recover", true);
    }
    if (this.time >= 1) {
      owner.behavior.changeTo(FrostPuffPursueState.name);
    }
  }

  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  exit(owner) {
    owner.shotTarget = null;
  }
}
