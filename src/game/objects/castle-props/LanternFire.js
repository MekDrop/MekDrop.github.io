import { CastleFire } from "../castle/CastleFire.js";

/**
 * Castle flame particles viewed through translucent lantern panes.
 */
export class LanternFire {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} lantern
   * @param {{x:number,y:number,z:number}} [position]
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} [modelLibrary]
   */
  static add(pc, lantern, position = { x: 0, y: 0.102, z: 0.047 }, modelLibrary) {
    const app = pc.Application.getApplication();
    const materials = [];
    for (const render of lantern.findComponents("render")) {
      for (const instance of render.meshInstances) {
        if (instance.material.name !== "Warm luminous amber glass") { continue; }
        const material = instance.material.clone();
        material.normalMap = null;
        material.diffuse.set(0.95, 0.72, 0.24);
        material.diffuseMapTint = true;
        material.emissive.set(0, 0, 0);
        material.emissiveMap = null;
        material.opacity = 0.72;
        material.blendType = pc.BLEND_NORMAL;
        material.depthWrite = false;
        material.cull = pc.CULLFACE_NONE;
        material.update();
        instance.material = material;
        materials.push(material);
      }
    }
    const fire = new CastleFire({
      pc, app, modelLibrary,
      particleTexture: app.assets.find("castleFireParticle", "texture").resource,
    });
    fire.add({ ...position, scale: 0.027, brazier: false, intensity: 0.25 });
    for (const particles of fire.entity.findComponents("particlesystem")) {
      // Flying sparks would escape this small closed housing.
      if (particles.entity.name !== "Rising fire particles") {
        particles.enabled = false;
      }
    }
    lantern.addChild(fire.entity);
    lantern.once("destroy", () => {
      fire.destroy();
      for (const material of materials) { material.destroy(); }
    });
  }
}
