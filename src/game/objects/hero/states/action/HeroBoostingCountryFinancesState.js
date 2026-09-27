import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { AbstractHeroActionState } from "./AbstractHeroActionState.js";

/**
 * Marks the castle activity that can later amplify tower-kill coin rewards.
 */
export class HeroBoostingCountryFinancesState extends AbstractHeroActionState {
  constructor() {
    super(HeroBoostingCountryFinancesState.name, HERO_ANIMATION.IDLE);
  }
}
