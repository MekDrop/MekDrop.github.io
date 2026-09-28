import shovelModelUrl from "../../../models/hero/tools/shovel.glb?url";
import { HERO_ANIMATION } from "../../../enum/HeroAnimation.js";
import { HeroTool } from "./HeroTool.js";

export class ShovelTool extends HeroTool {
  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return shovelModelUrl;
  }

  /**
   *
   * @param {{modelLibrary: string}} options
   * @param {string} options.modelLibrary
   */
  constructor({ modelLibrary }) {
    super({
      modelLibrary,
      modelUrl: ShovelTool.modelUrl,
      name: "shovel",
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
   * @param {number} context
   */
  useAnimation(context = {}) {
    return context.action === "fill"
      ? HERO_ANIMATION.FILL_HOLE
      : HERO_ANIMATION.CHOP_LOW;
  }
}
