import knifeModelUrl from "../../../models/hero/tools/knife.glb?url";
import { HeroTool } from "./HeroTool.js";

export class KnifeTool extends HeroTool {
  static get modelUrl() {
    return knifeModelUrl;
  }

  constructor({ modelLibrary }) {
    super({
      modelLibrary,
      modelUrl: KnifeTool.modelUrl,
      name: "foraging knife",
    });
  }
}
