import { State } from "yuka";
import { FrostPuffCastState } from "./FrostPuffCastState.js";

export class FrostPuffPursueState extends State {
  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  enter(owner) {
    owner.playClip("hover_move");
  }

  /**
   * @param {import("../FrostPuff.js").FrostPuff} owner
   */
  execute(owner) {
    if (owner.elapsed >= owner.nextShotAt) {
      owner.shotTarget = owner.combat.shotTarget;
      if (owner.shotTarget) {
        owner.behavior.changeTo(FrostPuffCastState.name);

        return;
      }
    }
    const royal = owner.resolveRoyalTarget();
    if (!royal) {
      owner.stop();
      owner.playClip("hover_idle");

      return;
    }
    if (owner.distanceTo(royal) < 0.85 && owner.hasLineOfSight(royal)) {
      owner.stop();
      owner.reachRoyal(royal);

      return;
    }
    owner.followOpening(royal, 1.15);
  }
}
