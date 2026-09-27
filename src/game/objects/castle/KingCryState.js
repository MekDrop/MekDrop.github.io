import { State } from "yuka";
import { ROYAL_ANIMATION } from "../../enum/RoyalAnimation.js";
import { ROYAL_GAME_OVER_PHASE } from "../../enum/RoyalGameOverPhase.js";

export class KingCryState extends State {
  get phase() {
    return ROYAL_GAME_OVER_PHASE.CRY;
  }

  enter(owner) {
    owner.playAnimation(ROYAL_ANIMATION.CRY, 0.18);
  }
}
