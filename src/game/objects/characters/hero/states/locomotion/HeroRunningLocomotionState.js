import { AbstractHeroLocomotionState } from "./AbstractHeroLocomotionState.js";
import { HERO_ANIMATION } from "../../../../../enum/HeroAnimation.js";
import { HERO_LOCOMOTION_STATE } from "../../../../../enum/HeroLocomotionState.js";

export class HeroRunningLocomotionState extends AbstractHeroLocomotionState {
  constructor() {
    super(HERO_LOCOMOTION_STATE.RUNNING, HERO_ANIMATION.RUN, true);
  }
}
