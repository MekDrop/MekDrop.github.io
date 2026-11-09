import posesUrl from "./alchemical-burner-poses.glb?url";
import specialPosesUrl from "./alchemical-burner-special-poses.glb?url";
import { HERO_ANIMATION } from "../../../enum/HeroAnimation.js";

export class BurnerAnimations {
  /**
   * @type {string}
   */
  static url = posesUrl;
  /**
   * @type {string}
   */
  static specialUrl = specialPosesUrl;
  /**
   * @type {string[]}
   */
  static names = [HERO_ANIMATION.BURN_BUSH_LOW, HERO_ANIMATION.BURN_BUSH_MIDDLE, HERO_ANIMATION.BURN_BUSH_HIGH];
}
