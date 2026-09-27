import { HERO_MOOD } from "../../../../enum/HeroMood.js";
import { AbstractHeroEmotionState } from "./AbstractHeroEmotionState.js";

export class HeroAngryEmotionState extends AbstractHeroEmotionState {
  constructor() {
    super(HERO_MOOD.ANGRY, 9, 4, { tracksPressureLevels: false });
  }

  get acceptsActions() {
    return false;
  }

  enter() {
    this.resetLevel();
  }

  rejectAction(owner) {
    this.increaseLevel();
    owner.refreshAnger();
  }

  coolDown(level) {
    this.setLevel(level);
  }
}
