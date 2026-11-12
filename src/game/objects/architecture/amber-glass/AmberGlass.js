/**
 * Shared mottled amber glazing for lantern housings and architectural windows.
 */
export class AmberGlass {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} visual
   * @param {{tint?: number[], opacity?: number, tiling?: number, cull?: number, authored?: boolean, paneRows?: number}} options
   */
  static add(pc, visual, { tint = [0.95, 0.72, 0.24], opacity = 0.72, tiling = 1, cull = pc.CULLFACE_NONE, authored = false, paneRows = 1 } = {}) {
    const materials = [];
    for (const render of visual.findComponents("render")) {
      for (const instance of render.meshInstances) {
        if (instance.material.name !== "Warm luminous amber glass" &&
          !instance.material.name.startsWith("Semitransparent amber glazing")) {
          continue;
        }
        const material = instance.material.clone();
        material.normalMap = null;
        if (authored) {
          AmberGlass.#fitPaneGradient(material, instance.node, paneRows);
        } else {
          material.diffuse.set(...tint);
          material.diffuseMapTint = true;
          material.diffuseMapTiling.set(tiling, tiling);
          material.emissive.set(0, 0, 0);
          material.emissiveMap = null;
        }
        material.opacity = opacity;
        material.blendType = pc.BLEND_NORMAL;
        material.depthWrite = false;
        material.cull = cull;
        material.update();
        instance.material = material;
        materials.push(material);
      }
    }
    visual.once("destroy", () => {
      for (const material of materials) {
        material.destroy();
      }
    });
  }

  /**
   * Map one continuous authored frosting/light gradient over repeated panes.
   * @param {import("playcanvas").StandardMaterial} material
   * @param {import("playcanvas").GraphNode} node
   * @param {number} rows
   */
  static #fitPaneGradient(material, node, rows) {
    let pane = node;
    while (pane.parent && !pane.name.startsWith("Amber glass pane ")) {
      pane = pane.parent;
    }
    const row = Number(pane.name.split(" ").at(-1)) || 0;
    material.diffuseMapTiling.set(1, 1 / rows);
    material.emissiveMapTiling.set(1, 1 / rows);
    material.diffuseMapOffset.set(0, row / rows);
    material.emissiveMapOffset.set(0, row / rows);
  }
}
