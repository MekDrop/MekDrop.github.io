import modelUrl from "../../models/castle/props/firewood-stack.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";
import { GenerationRandom } from "../../generator/map/GenerationRandom.js";

/**
 * Fills a bottom-centered local area with seeded, individually varied cut logs.
 * Width/depth/height are model-space metres, before the usual prop scale/stretch.
 */
export class FirewoodStack extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }

  /**
   * Reuse the authored log meshes for both visible and collision assemblies.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    const { width = 0.269, depth = 0.38, height = 0.2433, firewoodSeed } = this.definition;
    const originals = model.find(/**
     *
     * @param {import("playcanvas").Entity} entity
     */
    entity => entity.name.startsWith("Cut firewood log "));
    const templates = originals.map(/**
     *
     * @param {import("playcanvas").Entity} entity
     */
    entity => entity.clone());
    for (const original of originals) { original.destroy(); }
    if (!templates.length || ![width, depth, height].every(/**
     *
     * @param {number} value
     */
    value => Number.isFinite(value) && value > 0)) {
      for (const template of templates) { template.destroy(); }
      return;
    }
    const random = new GenerationRandom(String(firewoodSeed ?? this.definition.id));
    // Narrowing courses nest each upper log between two logs below it.
    const diameter = 0.088633;
    const logHeight = 0.0872862;
    const courseRise = Math.sqrt(logHeight ** 2 - (diameter / 2) ** 2);
    const columns = Math.max(1, Math.floor((width + 1e-6) / diameter));
    const rows = Math.max(1, Math.ceil(depth / 0.38));
    const layers = Math.min(columns, Math.max(1, Math.ceil((height - logHeight) / courseRise) + 1));
    if (columns * rows * layers > 4096) {
      for (const template of templates) { template.destroy(); }
      return;
    }
    const cellZ = depth / rows;
    const diameterScale = Math.min(1, width / (columns * diameter),
      height / (logHeight + (layers - 1) * courseRise));
    const pitch = diameter * diameterScale;
    for (let layer = 0; layer < layers; layer++) {
      const count = columns - layer;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < count; column++) {
          const log = templates[random.rng(0, templates.length - 1)].clone();
          const length = Math.min(0.38, cellZ) * random.rng(88, 100) / 100;
          const axialOffset = (cellZ - length) * random.rng(-50, 50) / 100;
          log.name = `Firewood log ${layer}-${row}-${column}`;
          log.setLocalEulerAngles(90, 0, 0);
          // Authored length is on the mesh's local Y axis.
          log.setLocalScale(diameterScale, length / 0.38, diameterScale);
          log.setLocalPosition((column - (count - 1) / 2) * pitch,
            (layer * courseRise + 0.0422862) * diameterScale,
            -depth / 2 + (row + 0.5) * cellZ + axialOffset);
          model.addChild(log);
        }
      }
    }
    for (const template of templates) { template.destroy(); }
  }
}
