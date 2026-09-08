import shovelModelUrl from "../../../models/hero/tools/shovel.glb?url";
import { HERO_ANIMATION } from "../../../enum/HeroAnimation.js";
import { HeroTool } from "./HeroTool.js";

export class ShovelTool extends HeroTool {
  static get modelUrl() {
    return shovelModelUrl;
  }

  constructor({ modelLibrary }) {
    super({
      modelLibrary,
      modelUrl: ShovelTool.modelUrl,
      name: "shovel",
    });
  }

  get summonAnimation() {
    return HERO_ANIMATION.SUMMON_AXE;
  }

  get dismissAnimation() {
    return HERO_ANIMATION.DISMISS_AXE;
  }

  useAnimation(context = {}) {
    return context.action === "fill"
      ? HERO_ANIMATION.FILL_HOLE
      : HERO_ANIMATION.CHOP_LOW;
  }
}
