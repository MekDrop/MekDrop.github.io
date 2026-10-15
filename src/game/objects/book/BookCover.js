/**
 * Changes leather bindings without recoloring parchment or shared asset materials.
 */
export class BookCover {
  /**
   * @type {WeakMap<import("playcanvas").StandardMaterial, Map<string, {material: import("playcanvas").StandardMaterial, users: number}>>}
   */
  static #materials = new WeakMap();

  /**
   * Equal bindings share a batchable material until their last owner is destroyed.
   * @param {import("playcanvas").Entity} model
   * @param {number[]} color
   */
  static apply(model, color) {
    this.tint(model, color, /**
     * @param {import("playcanvas").StandardMaterial} source
     */
    source => {
      let colors = this.#materials.get(source);
      if (!colors) { colors = new Map(); this.#materials.set(source, colors); }
      const key = color.join(",");
      let entry = colors.get(key);
      if (!entry) { entry = { material: source.clone(), users: 0 }; colors.set(key, entry); }
      entry.users++;
      model.once("destroy", () => {
        if (--entry.users === 0) { entry.material.destroy(); colors.delete(key); }
      });
      return entry.material;
    });
  }

  /**
   * @param {import("playcanvas").Entity} model
   * @param {number[]} color
   * @param {(material: import("playcanvas").StandardMaterial) => import("playcanvas").StandardMaterial} clone
   */
  static tint(model, color, clone) {
    if (!color) { return; }
    for (const render of model.findComponents("render")) {
      for (const mesh of render.meshInstances) {
        if (!/^(Book leather(?: \d+)?|Claret binding)$/.test(mesh.material.name)) { continue; }
        const material = clone(mesh.material);
        material.diffuseTint = true;
        material.diffuse.set(...color);
        material.update();
        mesh.material = material;
      }
    }
  }
}
