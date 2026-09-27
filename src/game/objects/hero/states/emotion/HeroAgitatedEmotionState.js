import { HERO_MOOD } from "../../../../enum/HeroMood.js";
import { AbstractHeroEmotionState } from "./AbstractHeroEmotionState.js";

export class HeroAgitatedEmotionState extends AbstractHeroEmotionState {
  constructor() {
    super(HERO_MOOD.AGITATED, 5, 4);
  }
}
