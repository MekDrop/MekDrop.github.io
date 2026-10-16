import singleModelUrl from "../../../models/castle/props/single-candle-stand.glb?url";
import floorModelUrl from "../../../models/castle/props/floor-candelabrum.glb?url";
import tableModelUrl from "../../../models/castle/props/table-candles.glb?url";
import { Fire } from "../../fire/Fire.js";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";
import { FireEffect } from "../../fire/FireEffect.js";

/**
 * Variant-selected candle models, authored collision and owned wick effects.
 */
export class CandleStand extends AbstractCastleProp {
  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);

    const model = this.visualRoots[0].children[0];
    this.#attachFlames(options, model);
  }

  /**
   * Keep each asset's wick coordinates and original particle appearance.
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   * @param {import("playcanvas").Entity} model
   */
  #attachFlames(options, model) {
    if ((this.definition.variant ?? "single") !== "single") {
      const inverse = model.getWorldTransform().clone().invert();
      const volume = this.definition.variant === "table" ? {
        x: 0.0115,
        y: 0.0828,
        z: 0.0115,
      } : {
        x: 0.0225,
        y: 0.162,
        z: 0.0225,
      };
      for (const name of ["Tall candle wick", "Middle candle wick", "Short candle wick"]) {
        const position = inverse.transformPoint(model.findByName(name).getPosition());
        Fire.attach(options.pc, model, position, volume);
      }

      return;
    }
    const app = options.pc.Application.getApplication();
    const fire = new FireEffect({
      pc: options.pc,
      app,
      particleTexture: app.assets.find("castleFireParticle", "texture").resource,
    });
    fire.add({
      x: 0,
      y: 0.64,
      z: 0,
      scale: 0.045,
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
  static get modelUrls() { return [singleModelUrl, floorModelUrl, tableModelUrl]; }

  /**
   * @returns {string}
   */
  get modelUrl() {
    return this.definition.variant === "floor" ? floorModelUrl :
      this.definition.variant === "table" ? tableModelUrl : singleModelUrl;
  }

}
