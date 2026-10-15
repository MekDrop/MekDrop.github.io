import modelUrl from "../../models/castle/props/single-candle-stand.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";
import { CastleFire } from "../castle/CastleFire.js";

/**
 * Authored single candle stand placed through the map objects array.
 */
export class SingleCandleStand extends AbstractCastleProp {
  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);
    const model = this.visualRoots[0].children[0];
    const app = options.pc.Application.getApplication();
    const fire = new CastleFire({
      pc: options.pc,
      app,
      modelLibrary: options.modelLibrary,
      particleTexture: app.assets.find("castleFireParticle", "texture").resource,
    });
    fire.add({
      x: 0,
      y: 0.64,
      z: 0,
      scale: 0.045,
      brazier: false,
      intensity: 0.3,
    });
    model.addChild(fire.entity);
    model.once("destroy", () => fire.destroy());
    const light = new options.pc.Entity("Candle warm glow");
    light.setLocalPosition(0, 0.72, 0);
    light.addComponent("light", {
      type: "omni",
      color: new options.pc.Color(1, 0.67, 0.25),
      intensity: 0.8,
      range: 2.5,
      castShadows: false,
    });
    model.addChild(light);
    let elapsed = 0;
    /**
     * @param {number} dt
     */
    const flicker = dt => {
      elapsed += dt;
      light.light.intensity = 0.8 + 0.08 * Math.sin(elapsed * 17) + 0.04 * Math.sin(elapsed * 29);
    };
    app.on("update", flicker);
    model.once("destroy", () => app.off("update", flicker));
  }
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
