import hammerModelUrl from "../../../../models/hero/tools/hammer.glb?url";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroTool } from "./HeroTool.js";
import { Vec3 } from "playcanvas";

/**
 * A heavy, two-handed hammer with a single deck impact per stroke.
 */
export class HammerTool extends HeroTool {
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return hammerModelUrl;
  }

  /**
   * @param {{modelLibrary: import("../../../../models/GameModelLibrary.js").GameModelLibrary}} options
   */
  constructor({ modelLibrary }) {
    super({
      modelLibrary,
      modelUrl: HammerTool.modelUrl,
      name: "hammer",
    });
  }

  /**
   * @returns {string}
   */
  get summonAnimation() {
    return HERO_ANIMATION.SUMMON_HAMMER;
  }

  /**
   * @returns {string}
   */
  get dismissAnimation() {
    return HERO_ANIMATION.DISMISS_HAMMER;
  }

  /**
   * @returns {string}
   */
  useAnimation() {
    return HERO_ANIMATION.SMASH_BRIDGE;
  }

  /**
   * @returns {number}
   */
  get useDuration() {
    return 1.8;
  }

  /**
   * @returns {number}
   */
  get impactTime() {
    return 0.94;
  }

  /**
   * @returns {number}
   */
  get summonVisibilityTime() {
    return 0.3;
  }

  /**
   * @returns {number}
   */
  get dismissVisibilityTime() {
    return 0.28;
  }

  /**
   * @returns {Vec3}
   */
  get mountOffset() {
    return new Vec3(0, 0, 0);
  }

  /**
   * @param {import("playcanvas").Entity} parent
   */
  mount(parent) {
    while (parent.parent && !parent.findByName("Hammer grip")) {
      parent = parent.parent;
    }
    super.mount(parent.findByName("Hammer grip") ?? parent.findByName("Right white glove"));
  }
}
