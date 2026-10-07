import roofUrl from "../../models/castle/residential/blue-roof.glb?url";

/**
 * Places the authored tiled roof module on each generated roof footprint.
 */
export class CastleRoof {
  /**
   * @returns {string}
   */
  static get modelUrl() { return roofUrl; }
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("../../models/GameModelLibrary.js").GameModelLibrary}
   */
  #modelLibrary;
  /**
   * @type {import("playcanvas").StandardMaterial}
   */
  #masonryMaterial;
  /**
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, masonryMaterial: import("playcanvas").StandardMaterial}} options
   */
  constructor({ pc, modelLibrary, masonryMaterial }) {
    this.#entity = new pc.Entity("Authored castle roofs");
    this.#modelLibrary = modelLibrary;
    this.#masonryMaterial = masonryMaterial.clone();
    this.#masonryMaterial.name = "Castle darker gable masonry";
    this.#masonryMaterial.diffuse.mulScalar(0.8);
    const coordinates = masonryMaterial.getParameter("uWorldToCastle");
    if (coordinates) {
      this.#masonryMaterial.setParameter("uWorldToCastle", coordinates.data);
    }
    this.#masonryMaterial.update();
  }
  get entity() { return this.#entity; }
  /**
   * @param {{x: number, y: number, z: number, yaw?: number, width?: number, depth?: number, height?: number}} options
   */
  add({ x, y, z, yaw = 0, width = 1.4, depth = 1.4, height = 0.9 }) {
    const roof = this.#modelLibrary.instantiate(roofUrl);
    roof.name = "Blender tiled blue roof";
    roof.setLocalPosition(x, y, z);
    roof.setLocalEulerAngles(0, yaw, 0);
    roof.setLocalScale(width, height, depth);
    this.#entity.addChild(roof);
    for (const render of roof.findComponents("render")) {
      for (const instance of render.meshInstances) {
        if (instance.material.name.startsWith("Roof gable sandstone")) {
          instance.material = this.#masonryMaterial;
        }
      }
    }
    // The authored stepped courses own both the visible surface and Ammo contact.
    // Boxes match each course rather than enclosing the whole pitched silhouette.
    roof.addComponent("collision", { type: "compound" });
    for (const render of roof.findComponents("render")) {
      if (!render.entity.name.startsWith("Hipped roof course") && render.entity.name !== "Roof cap" &&
        !render.entity.name.startsWith("Dormer stone body")) { continue; }
      const bounds = render.meshInstances[0].mesh.aabb;
      render.entity.addComponent("collision", { type: "box", halfExtents: bounds.halfExtents.clone(),
        linearOffset: bounds.center.clone() });
    }
    roof.addComponent("rigidbody", { type: "static", friction: 0.8, restitution: 0 });
  }
  destroy() {
    this.#entity.destroy();
    this.#masonryMaterial.destroy();
  }
}
