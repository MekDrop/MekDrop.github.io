import { HERO_MOOD } from "../../../../enum/HeroMood.js";
import { AbstractHeroEmotionState } from "./AbstractHeroEmotionState.js";

export class HeroAngryEmotionState extends AbstractHeroEmotionState {
  constructor() {
    super(HERO_MOOD.ANGRY, 9, 4, { tracksPressureLevels: false });
  }

  /**
   *
    * @returns {boolean}
   */
  get acceptsActions() {
    return false;
  }

  enter() {
    this.resetLevel();
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  rejectAction(owner) {
    this.increaseLevel();
    owner.refreshAnger();
  }

  /**
   *
   * @param {number} level
   */
  coolDown(level) {
    this.setLevel(level);
  }
}
