import axeModelUrl from "../../../models/hero/tools/axe.glb?url";
import { HERO_ANIMATION } from "../../../enum/HeroAnimation.js";
import { HeroTool } from "./HeroTool.js";

export class AxeTool extends HeroTool {
  static get modelUrl() {
    return axeModelUrl;
  }

  constructor({ modelLibrary }) {
    super({
      modelLibrary,
      modelUrl: AxeTool.modelUrl,
      name: "axe",
    });
  }

  get summonAnimation() {
    return HERO_ANIMATION.SUMMON_AXE;
  }

  get dismissAnimation() {
    return HERO_ANIMATION.DISMISS_AXE;
  }

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
