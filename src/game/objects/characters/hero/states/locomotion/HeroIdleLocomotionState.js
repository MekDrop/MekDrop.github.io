import { AbstractHeroLocomotionState } from "./AbstractHeroLocomotionState.js";
import { HERO_ANIMATION } from "../../../../../enum/HeroAnimation.js";
import { HERO_LOCOMOTION_STATE } from "../../../../../enum/HeroLocomotionState.js";

export class HeroIdleLocomotionState extends AbstractHeroLocomotionState {
  constructor() {
    super(HERO_LOCOMOTION_STATE.IDLE, HERO_ANIMATION.IDLE);
  }
}
