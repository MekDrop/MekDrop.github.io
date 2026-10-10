import { CastleFire } from "../castle/CastleFire.js";

/**
 * Animated castle fire attached to the wick anchors in authored candle props.
 */
export class CandleFire {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} model
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} modelLibrary
   * @param {number} scale
   */
  static add(pc, model, modelLibrary, scale) {
    const app = pc.Application.getApplication();
    const fire = new CastleFire({
      pc,
      app,
      modelLibrary,
      particleTexture: app.assets.find("castleFireParticle", "texture").resource,
    });
    const inverse = model.getWorldTransform().clone().invert();
    for (const name of ["Tall candle wick", "Middle candle wick", "Short candle wick"]) {
      const wick = model.findByName(name);
      const position = inverse.transformPoint(wick.getPosition());
      fire.add({
        x: position.x,
        y: position.y - scale * 0.78,
        z: position.z,
        scale,
        brazier: false,
        intensity: 0.3,
      });
    }
    // Candle flames rise from a narrow wick instead of wandering across a brazier.
    for (const particles of fire.entity.findComponents("particlesystem")) {
      if (particles.entity.name !== "Rising fire particles") {
        continue;
      }
      particles.emitterExtents = new pc.Vec3(scale * 0.08, scale * 0.04, scale * 0.08);
      particles.localVelocityGraph = new pc.CurveSet([
        [0, 0, 1, 0],
        [0, scale * 3.6, 0.55, scale * 3.1, 1, scale * 2],
        [0, 0, 1, 0],
      ]);
      particles.localVelocityGraph2 = new pc.CurveSet([
        [0, 0, 1, 0],
        [0, scale * 4.5, 0.55, scale * 3.5, 1, scale * 2.2],
        [0, 0, 1, 0],
      ]);
    }
    model.addChild(fire.entity);
    model.once("destroy", () => fire.destroy());
  }
}
