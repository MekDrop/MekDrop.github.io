import { State } from "yuka";
import { ROYAL_ANIMATION } from "../../enum/RoyalAnimation.js";
import { ROYAL_GAME_OVER_PHASE } from "../../enum/RoyalGameOverPhase.js";

export class QueenCryState extends State {
  /**
   *
    * @returns {string|number}
   */
  get phase() {
    return ROYAL_GAME_OVER_PHASE.CRY;
  }

  /**
   *
   * @param {{playAnimation: (animation: string, blendDuration?: number) => void}} owner
   */
  enter(owner) {
    owner.playAnimation(ROYAL_ANIMATION.CRY, 0.18);
  }
}
