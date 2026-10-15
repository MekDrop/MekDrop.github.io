import { arePositiveFiniteNumbers } from "../../helpers/types.js";
import modelUrl from "../../models/castle/props/folded-linens.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";
import { GenerationRandom } from "../../generator/map/GenerationRandom.js";

/**
 * Grounded stack of cream and blue folded household linens.
 */
export class FoldedLinens extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }

  /**
   * Pack authored linen bundles into a bottom-centered, repeatable local area.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    const { width = 0.3, depth = 0.22, height = 0.16, linenSeed } = this.definition;
    const original = model.findByName("folded-linens");
    if (!original) { return; }
    const template = original.clone();
    original.destroy();
    if (!arePositiveFiniteNumbers(width, depth, height)) {
      template.destroy();
      return;
    }
    const columns = Math.max(1, Math.floor((width + 1e-6) / 0.3));
    const rows = Math.max(1, Math.floor((depth + 1e-6) / 0.22));
    const layers = Math.max(1, Math.ceil(height / 0.16));
    if (columns * rows * layers > 4096) {
      template.destroy();
      return;
    }
    const random = new GenerationRandom(String(linenSeed ?? this.definition.id));
    const cellX = width / columns;
    const cellZ = depth / rows;
    const cellY = height / layers;
    // The asset is one complete folded bundle, so repeat it without splitting its mesh.
    // Keep every course at the same footprint to maintain support between bundles.
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const sizeX = Math.min(0.3, cellX);
        const sizeZ = Math.min(0.22, cellZ);
        const offsetX = (cellX - sizeX) * random.rng(-50, 50) / 100;
        const offsetZ = (cellZ - sizeZ) * random.rng(-50, 50) / 100;
        for (let layer = 0; layer < layers; layer++) {
          const bundle = template.clone();
          bundle.name = `Linen bundle ${layer}-${row}-${column}`;
          bundle.setLocalScale(sizeX / 0.3, cellY / 0.16, sizeZ / 0.22);
          bundle.setLocalEulerAngles(0, random.rng(0, 1) * 180, 0);
          bundle.setLocalPosition(-width / 2 + (column + 0.5) * cellX + offsetX,
            layer * cellY, -depth / 2 + (row + 0.5) * cellZ + offsetZ);
          model.addChild(bundle);
        }
      }
    }
    template.destroy();
  }
}
