/**
 * Shared bridge palette: tan walking tiles, darker oak framing, muted fittings.
 * Each visual owner leases its own clones so fading cannot recolour other props.
 */
export class BridgePalette {
  /**
   * @type {Map<import("playcanvas").Material, Map<string, import("playcanvas").StandardMaterial>>}
   */
  #materials = new Map();

  /**
   * @param {import("playcanvas").Entity} root
   */
  constructor(root) {
    root.once("destroy", this.#destroy, this);
  }

  /**
   * Multipliers preserve the shared grain; extra green/blue soften its orange
   * cast. Values above one on deck channels lift the existing texture's albedo.
   * @param {import("playcanvas").StandardMaterial} source
   * @param {string} role
   * @returns {import("playcanvas").StandardMaterial}
   */
  materialFor(source, role) {
    if (role === "lift") {
      return source;
    }
    let variants = this.#materials.get(source);
    if (!variants) {
      variants = new Map();
      this.#materials.set(source, variants);
    }
    let material = variants.get(role);
    if (!material) {
      material = source.clone();
      material.name = `${source.name} bridge ${role}`;
      if (role === "deck") {
        material.diffuse.set(1.06, 1.25, 1.55);
      } else if (role === "metal") {
        material.diffuse.set(0.42, 0.4, 0.34);
        material.metalness = 0.3;
      } else {
        material.diffuse.set(0.72, 0.78, 0.86);
      }
      material.gloss = 0.08;
      material.update();
      variants.set(role, material);
    }

    return material;
  }

  #destroy() {
    for (const variants of this.#materials.values()) {
      for (const material of variants.values()) {
        material.destroy();
      }
    }
    this.#materials.clear();
  }
}
