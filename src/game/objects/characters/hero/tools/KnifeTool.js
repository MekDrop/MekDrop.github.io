import knifeModelUrl from "../../../../models/hero/tools/knife.glb?url";
import { HeroTool } from "./HeroTool.js";
import { Quat, Vec3 } from "playcanvas";

export class KnifeTool extends HeroTool {
  /**
   * @returns {Vec3}
   */
  get mountOffset() {
    return new Vec3(0, -0.055, 0.06);
  }

  /**
   * @param {import("playcanvas").Entity} parent
   */
  mount(parent) {
    super.mount(parent.findByName("Right white glove"));
    this.entity.setLocalScale(0.6, 0.6, 0.6);
    const geometryRotation = new Quat(
      -0.1116188988, 0.1330222189, -0.6330222487, 0.7544065118,
    );
    const rotation = new Quat().setFromEulerAngles(90, 0, 0)
      .mul(new Quat().setFromEulerAngles(0, 0, -90))
      .mul(geometryRotation.invert());
    this.entity.setLocalRotation(rotation.x, rotation.y, rotation.z, rotation.w);
  }

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
