import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

export class HeroGameOverActionState extends HeroRuntimeActionState {
  constructor() {
    super(HERO_ACTION.GAME_OVER, {
      animation: HERO_ANIMATION.FALL_DEATH,
      incapacitated: true,
      locksFacing: true,
      allowsFootPlacement: false,
      allowsIdleHeadLook: false,
    });
  }

  enter(owner) {
    super.enter(owner);
    owner.feedback.gameOver.begin();
  }
}
