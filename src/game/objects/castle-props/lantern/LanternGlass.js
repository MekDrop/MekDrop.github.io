/**
 * Translucent glass materials for lantern housings.
 */
export class LanternGlass {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} lantern
   */
  static add(pc, lantern) {
    const materials = [];
    for (const render of lantern.findComponents("render")) {
      for (const instance of render.meshInstances) {
        if (instance.material.name !== "Warm luminous amber glass") {
          continue;
        }
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
    lantern.once("destroy", () => {
      for (const material of materials) {
        material.destroy();
      }
    });
  }
}
