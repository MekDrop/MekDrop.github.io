import knifeModelUrl from "../../../models/hero/tools/knife.glb?url";
import { HeroTool } from "./HeroTool.js";

export class KnifeTool extends HeroTool {
  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return knifeModelUrl;
  }

  /**
   *
   * @param {{modelLibrary: string}} options
   * @param {string} options.modelLibrary
   */
  constructor({ modelLibrary }) {
    super({
      modelLibrary,
      modelUrl: KnifeTool.modelUrl,
      name: "foraging knife",
    });
  }
}
