import roofUrl from "../../models/castle/residential/blue-roof.glb?url";

/**
 * Places the authored tiled roof module on each generated roof footprint.
 */
export class CastleRoof {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
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
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, masonryMaterial: import("playcanvas").StandardMaterial}} options
   */
  constructor({ pc, app, modelLibrary, masonryMaterial }) {
    this.#pc = pc;
    this.#app = app;
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
    roof.tags.add("capsule-support");
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
        !render.entity.name.startsWith("Dormer stone body") && !render.entity.name.startsWith("Dormer blue roof course")) { continue; }
      // GLB splits each course into material sections. The first section alone
      // leaves the other tile colours and gable masonry without collision.
      const bounds = render.meshInstances[0].mesh.aabb.clone();
      for (const instance of render.meshInstances.slice(1)) {
        bounds.add(instance.mesh.aabb);
      }
      // Primitive collision dimensions and offsets are in world units; Ammo does
      // not apply the imported mesh hierarchy's scale to these box properties.
      const scale = render.entity.getWorldTransform().getScale();
      render.entity.addComponent("collision", { type: "box", halfExtents: bounds.halfExtents.clone().mul(scale),
        linearOffset: bounds.center.clone().mul(scale) });
    }
    roof.addComponent("rigidbody", { type: "static", friction: 0.8, restitution: 0 });
  }
  /**
   * Read roof support from Ammo without creating a duplicate terrain floor.
   * @param {number} x
   * @param {number} z
   * @param {number} maximumHeight
   * @returns {number|null}
   */
  surfaceHeightAt(x, z, maximumHeight) {
    const hits = this.#app.systems.rigidbody.raycastAll(
      new this.#pc.Vec3(x, maximumHeight, z),
      new this.#pc.Vec3(x, maximumHeight - 0.64, z),
      {
        sort: true,
        /**
         * @param {import("playcanvas").Entity} entity
         * @returns {boolean}
         */
        filterCallback: (entity) => {
          for (let node = entity; node; node = node.parent) {
            if (node === this.#entity) { return true; }
          }
          return false;
        },
      },
    );
    for (const hit of hits) {
      if (hit.normal.y >= 0.35) { return hit.point.y; }
    }
    return null;
  }
  destroy() {
    this.#entity.destroy();
    this.#masonryMaterial.destroy();
  }
}
