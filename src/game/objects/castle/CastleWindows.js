import hallUrl from "../../models/castle/windows/hall-window.glb?url";
import roomUrl from "../../models/castle/windows/room-window.glb?url";
import slitUrl from "../../models/castle/windows/slit-window.glb?url";

/**
 * Castle-owned, authored window inserts, oriented with local +Z outdoors.
 */
export class CastleWindows {
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;

  get entity() { return this.#entity; }
  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [hallUrl, roomUrl, slitUrl];
  }

  /**
   * @param {{pc:typeof import("playcanvas"),modelLibrary:import("../../models/GameModelLibrary.js").GameModelLibrary,windows:import("./CastleWindowLayout.js").RecessedWindow[],wallMaterial?:import("playcanvas").Material}} options
   */
  constructor({ pc, modelLibrary, windows, wallMaterial = null }) {
    this.#entity = new pc.Entity("Castle recessed windows");
    for (const window of windows) {
      const visual = modelLibrary.instantiate(window.role === "slit" ? slitUrl : window.role === "hall" && window.height > 0.75 ? hallUrl : roomUrl);
      visual.name = `Castle ${window.role} recessed window`;
      // The reveal is part of this wall, including its authored stone texture.
      // Timber and individual translucent panes keep their own materials.
      if (wallMaterial) {
        for (const render of visual.findComponents("render")) {
          for (const mesh of render.meshInstances) {
            if (mesh.material.name.includes("limestone")) {
              mesh.material = wallMaterial;
            }
          }
        }
      }
      visual.setLocalPosition(window.position.x, window.position.y, window.position.z);
      visual.setLocalEulerAngles(0, window.yaw, 0);
      visual.setLocalScale(window.width, window.height, window.depth);
      this.#entity.addChild(visual);
      const angle = window.yaw * Math.PI / 180;
      const glow = new pc.Entity("Castle amber window glow");
      glow.setLocalPosition(window.position.x - Math.sin(angle) * window.depth * 0.2,
        window.position.y + window.height / 2, window.position.z - Math.cos(angle) * window.depth * 0.2);
      glow.addComponent("light", { type: "omni", color: new pc.Color(1, 0.38, 0.06), intensity: 0.45, range: 0.9, castShadows: false });
      this.#entity.addChild(glow);
    }
  }
}
