import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { AbstractHeroActionState } from "./AbstractHeroActionState.js";

export class HeroExploringState extends AbstractHeroActionState {
  constructor() {
    super(HeroExploringState.name, HERO_ANIMATION.IDLE);
  }
}
