import { HERO_MOOD } from "../../../../enum/HeroMood.js";
import { AbstractHeroEmotionState } from "./AbstractHeroEmotionState.js";

export class HeroHappyEmotionState extends AbstractHeroEmotionState {
  constructor() {
    super(HERO_MOOD.HAPPY, 1, 4);
  }
}
