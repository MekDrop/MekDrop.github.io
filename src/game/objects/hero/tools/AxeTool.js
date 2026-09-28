import axeModelUrl from "../../../models/hero/tools/axe.glb?url";
import { HERO_ANIMATION } from "../../../enum/HeroAnimation.js";
import { HeroTool } from "./HeroTool.js";

export class AxeTool extends HeroTool {
  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return axeModelUrl;
  }

  /**
   *
   * @param {{modelLibrary: string}} options
   * @param {string} options.modelLibrary
   */
  constructor({ modelLibrary }) {
    super({
      modelLibrary,
      modelUrl: AxeTool.modelUrl,
      name: "axe",
    });
  }

  /**
   *
    * @returns {string|number}
   */
  get summonAnimation() {
    return HERO_ANIMATION.SUMMON_AXE;
  }

  /**
   *
    * @returns {string|number}
   */
  get dismissAnimation() {
    return HERO_ANIMATION.DISMISS_AXE;
  }

  /**
   *
   * @param {{heightClass: number}} options
   * @param {number} options.heightClass
   */
  useAnimation({ heightClass } = {}) {
    switch (heightClass) {
      case "low":
        return HERO_ANIMATION.CHOP_LOW;
      case "middle":
        return HERO_ANIMATION.CHOP_MIDDLE;
      case "high":
        return HERO_ANIMATION.CHOP_HIGH;
      default:
        return null;
    }
  }
}
